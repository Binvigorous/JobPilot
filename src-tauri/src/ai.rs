//! # AI 模块 - AI 服务调用层
//!
//! 负责与 AI 服务通信，提供岗位 JD 解析、面试题生成、图片解析等功能。
//!
//! ## 两种 API 协议
//!
//! 1. **Anthropic 兼容** (`anthropic_compatible`)
//!    - 端点: `{base_url}/messages`
//!    - 认证: `x-api-key` header
//!    - 特点: system message 映射为 assistant
//!    - 适用: Anthropic 官方 API、火山引擎 Anthropic 协议端点等
//!
//! 2. **OpenAI 兼容** (`openai_compatible`)
//!    - 端点: `{base_url}/chat/completions`
//!    - 认证: `Authorization: Bearer` header
//!    - 特点: 标准 chat completions 格式
//!    - 适用: OpenAI、DeepSeek、智谱、月之暗面、豆包、MiniMax、火山引擎 OpenAI 协议端点等
//!
//! ## 配置方式
//!
//! 用户无需选择具体厂商，只需配置：
//! - protocol: `openai_compatible` 或 `anthropic_compatible`
//! - base_url: API 端点地址（必填）
//! - api_key: API 密钥
//! - model: 模型名称

use crate::error::AppError;
use crate::models::{AiParseResult, AiProviderConfig, TestConnectionResult};
use regex::Regex;
use serde_json::{json, Value};
use std::time::Duration;

// ─────────────────────────────────────────────────────────────────────────────
// 常量：Prompt 模板
// ─────────────────────────────────────────────────────────────────────────────

/// 解析 JD 的系统提示词模板
/// AI 会根据这个模板返回结构化的 JSON 数据
const PARSE_JD_PROMPT: &str = r#"请分析以下职位描述（JD），返回结构化的JSON结果。

## 待分析的JD内容
{{JD}}

## 输出要求
请严格按照以下JSON格式返回，不要包含任何其他文字，不要用markdown格式：
{
  "extractedFields": {
    "title": "岗位名称",
    "company": "公司名",
    "salary": "薪资范围（如 25-40K）",
    "location": "工作地点（如 北京市昌平区、杭州市余杭区等）",
    "companyAddress": "公司详细地址（如 北京市朝阳区建国路88号）",
    "experience": "经验要求（如 3-5年）",
    "education": "学历要求（如 本科）",
    "companySize": "公司规模（如 100-499人）"
  },
  "parsedContent": {
    "responsibilities": [
      {
        "text": "职责描述",
        "category": "业务|技术|管理",
        "importance": "high|medium|low"
      }
    ],
    "requirements": [
      {
        "text": "要求描述",
        "type": "must|plus",
        "importance": 1-5
      }
    ]
  },
  "keywords": {
    "tech": [
      {
        "name": "技术关键词",
        "level": "基础|熟练|精通",
        "importance": 1-5
      }
    ],
    "skills": [
      {
        "name": "核心能力",
        "importance": 1-5
      }
    ],
    "softSkills": [
      {
        "name": "软技能",
        "importance": 1-5
      }
    ]
  },
  "roleAnalysis": {
    "roleType": "岗位类型（如 后端开发/AI产品经理）",
    "seniority": "初级|中级|高级",
    "focusAreas": ["核心关注点1", "核心关注点2"],
    "typicalInterviewRounds": ["HR面", "技术面", "业务面"]
  },
  "interviewInsights": {
    "highFrequencyTopics": ["高频考察点1", "高频考察点2"],
    "potentialQuestions": [
      {
        "question": "可能被问的问题",
        "type": "技术|行为|业务",
        "difficulty": "简单|中等|困难"
      }
    ]
  },
  "preparationGuide": {
    "priorityPreparation": [
      {
        "topic": "重点准备内容",
        "reason": "为什么重要",
        "action": "具体准备建议（可执行）"
      }
    ],
    "projectPreparation": [
      "如何准备项目经历（具体建议）"
    ],
    "resumeOptimization": [
      "简历优化建议"
    ]
  }
}

请根据以上JD内容，返回对应的JSON结果。"#;

// ─────────────────────────────────────────────────────────────────────────────
// JSON 解析辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/// 从 AI 返回的文本中提取 JSON
/// AI 有时会返回 markdown 格式的代码块，这个函数会处理各种情况
fn extract_json(text: &str) -> String {
    // 先尝试 markdown 代码块格式
    if let Ok(re) = Regex::new(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```") {
        if let Some(caps) = re.captures(text) {
            if let Some(m) = caps.get(1) {
                return m.as_str().to_string();
            }
        }
    }
    // 再尝试直接找 { } 包裹的内容
    if let Ok(re) = Regex::new(r"\{[\s\S]*\}") {
        if let Some(m) = re.find(text) {
            return m.as_str().to_string();
        }
    }
    text.to_string()
}

/// 安全解析 JSON，处理各种边缘情况
fn safe_json_parse(text: &str) -> Result<Value, AppError> {
    let cleaned = extract_json(text);
    match serde_json::from_str::<Value>(&cleaned) {
        Ok(v) => Ok(v),
        Err(_) => {
            // 再试一次：找到第一个 { 到最后一个 } 之间的内容
            let start = cleaned.find('{');
            let end = cleaned.rfind('}');
            if let (Some(s), Some(e)) = (start, end) {
                if s < e {
                    if let Ok(v) = serde_json::from_str::<Value>(&cleaned[s..=e]) {
                        return Ok(v);
                    }
                }
            }
            Err(AppError::Ai("Failed to parse AI response as JSON".into()))
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心：AI 调用函数
// ─────────────────────────────────────────────────────────────────────────────

/// 调用 AI 的核心函数
///
/// # 参数
/// - `protocol`: 协议类型 (openai_compatible / anthropic_compatible)
/// - `api_key`: API 密钥
/// - `base_url`: API 地址（必填）
/// - `model`: 模型名称（必填）
/// - `messages`: 消息列表，每项是 (role, content) 元组
///
/// # 返回
/// AI 返回的文本内容
///
/// # 两种调用路径
/// - **Anthropic 兼容**: POST `{base_url}/messages`，用 `x-api-key` 认证
/// - **OpenAI 兼容**: POST `{base_url}/chat/completions`，用 `Authorization: Bearer` 认证
async fn call_ai(
    protocol: &str,
    api_key: &str,
    base_url: &str,
    model: &str,
    messages: Vec<(&str, Value)>,
) -> Result<String, AppError> {
    // base_url 和 model 必须由用户显式配置
    if base_url.is_empty() {
        return Err(AppError::Ai("Base URL 未配置，请在 AI 设置中填写 API 端点地址".into()));
    }
    if model.is_empty() {
        return Err(AppError::Ai("Model 未配置，请在 AI 设置中填写模型名称".into()));
    }

    // 创建 HTTP 客户端，120秒超时
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    // ─── Anthropic 兼容协议 ───
    // 走 /messages 端点
    // 认证：同时发送 x-api-key（官方 Anthropic）和 Authorization: Bearer（火山引擎等第三方）
    // 两种 header 均携带，由服务端决定使用哪种，确保最大兼容性
    if protocol == "anthropic_compatible" {
        let api_messages: Vec<Value> = messages
            .iter()
            .map(|(role, content)| {
                // 注意：Anthropic 不支持 system role，映射为 user
                let mapped_role = if *role == "system" { "user" } else { role };
                json!({ "role": mapped_role, "content": content })
            })
            .collect();

        let body = json!({
            "model": model,
            "max_tokens": 4096,
            "messages": api_messages,
        });

        let resp = client
            .post(format!("{}/messages", base_url))
            .header("Content-Type", "application/json")
            .header("x-api-key", api_key)                                    // 官方 Anthropic 认证
            .header("Authorization", format!("Bearer {}", api_key))          // 火山引擎等第三方认证
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Anthropic request failed: {}", e)))?;

        // 错误处理
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "AI API error: {} - {}",
                status,
                &text[..text.len().min(300)]
            )));
        }

        // 解析 Anthropic 格式的响应
        // 响应格式: { "content": [{ "type": "text", "text": "..." }] }
        let data: Value = resp.json().await.map_err(|e| AppError::Ai(e.to_string()))?;
        let text = data
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.iter().find(|item| item.get("type").and_then(|t| t.as_str()) == Some("text")))
            .and_then(|item| item.get("text"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();

        Ok(text)
    }
    // ─── OpenAI 兼容格式 ───
    // 走 /chat/completions 端点，用 Bearer token 认证
    else {
        // 去掉可能的 /chat/completions 后缀，避免重复拼接
        let base = Regex::new(r"/chat/completions/?$")
            .unwrap()
            .replace_all(base_url, "")
            .to_string();

        let api_messages: Vec<Value> = messages
            .iter()
            .map(|(role, content)| json!({ "role": role, "content": content }))
            .collect();

        let body = json!({
            "model": model,
            "messages": api_messages,
            "temperature": 0.3, // 低温度，更稳定的输出
            "max_tokens": 8192, // 推理模型（如 glm-5.1）需要足够空间放思考过程，否则 content 会为空
        });

        let resp = client
            .post(format!("{}/chat/completions", base))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("AI API request failed: {}", e)))?;

        // 错误处理
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "AI API error: {} - {}",
                status,
                &text[..text.len().min(300)]
            )));
        }

        // 解析 OpenAI 格式的响应
        // 标准格式: { "choices": [{ "message": { "content": "..." } }] }
        // 推理模型格式 (如 glm-5.1): content 可能为空，实际回复在 content 里，
        //   但思考过程在 reasoning_content 里占用大量 token，需要足够的 max_tokens
        let data: Value = resp.json().await.map_err(|e| AppError::Ai(e.to_string()))?;
        let message = data
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"));

        let text = message
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .filter(|s| !s.is_empty()) // content 为空时降级到 reasoning_content
            .or_else(|| {
                message
                    .and_then(|m| m.get("reasoning_content"))
                    .and_then(|c| c.as_str())
                    .filter(|s| !s.is_empty())
            })
            .unwrap_or("")
            .to_string();

        Ok(text)
    }
}

fn get_active_config_text() -> String {
    "No active AI provider configured. Please add one in Settings > AI Config.".to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开函数：岗位 JD 解析
// ─────────────────────────────────────────────────────────────────────────────

/// 解析职位描述（JD）
///
/// 将一段 JD 文本发送给 AI，AI 返回结构化的解析结果：
/// - extractedFields: 提取的字段（标题、公司、薪资等）
/// - parsedContent: 解析后的内容（职责、要求）
/// - keywords: 关键词（技术、技能、软技能）
/// - roleAnalysis: 角色分析
/// - interviewInsights: 面试洞察
/// - preparationGuide: 准备指南
pub async fn parse_jd(
    jd_content: &str,
    config: &AiProviderConfig,
) -> Result<AiParseResult, AppError> {
    let system_msg = "You are a professional job analysis assistant. Always respond with valid JSON only, no markdown formatting.";
    let user_msg = PARSE_JD_PROMPT.replace("{{JD}}", jd_content);

    let messages = vec![
        ("system", json!(system_msg)),
        ("user", json!(user_msg)),
    ];

    let content = call_ai(
        &config.provider,
        &config.api_key,
        config.base_url.as_deref().unwrap_or(""),
        &config.model,
        messages,
    )
    .await?;

    if content.is_empty() {
        return Err(AppError::Ai("AI returned empty response".into()));
    }

    let result = safe_json_parse(&content)?;

    Ok(AiParseResult {
        extracted_fields: result.get("extractedFields").cloned().unwrap_or(json!({})),
        parsed_content: result
            .get("parsedContent")
            .cloned()
            .unwrap_or(json!({ "responsibilities": [], "requirements": [] })),
        keywords: result
            .get("keywords")
            .cloned()
            .unwrap_or(json!({ "tech": [], "skills": [], "softSkills": [] })),
        role_analysis: result.get("roleAnalysis").cloned().unwrap_or(json!({})),
        interview_insights: result
            .get("interviewInsights")
            .cloned()
            .unwrap_or(json!({})),
        preparation_guide: result
            .get("preparationGuide")
            .cloned()
            .unwrap_or(json!({})),
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// 错误解析辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/// 解析 AI 错误，返回用户友好的提示信息
fn parse_ai_error(err: &AppError) -> String {
    let msg = match err {
        AppError::Ai(s) => s.as_str(),
        _ => return format!("请求失败：{}", err),
    };

    // 根据错误信息匹配具体问题
    if msg.contains("401") || msg.contains("Unauthorized") || msg.contains("invalid") {
        "API Key 无效或已过期，请检查密钥是否正确".into()
    } else if msg.contains("403") || msg.contains("Forbidden") || msg.contains("permission") {
        "API Key 没有权限访问此模型，请检查密钥权限".into()
    } else if msg.contains("404") || msg.contains("Not Found") || msg.contains("not found") {
        "API 地址或模型名称错误，请检查 Base URL 和 Model 配置".into()
    } else if msg.contains("429") || msg.contains("Too Many Requests") || msg.contains("rate limit") || msg.contains("rate_limit") {
        "请求被限流或额度已用完，请稍后重试或检查账户额度".into()
    } else if msg.contains("500") || msg.contains("502") || msg.contains("503") || msg.contains("Internal Server Error") {
        "AI 服务端错误，可能是模型暂时不可用，请稍后重试".into()
    } else if msg.contains("timed out") || msg.contains("timeout") || msg.contains("request timeout") {
        "请求超时，请检查网络连接".into()
    } else if msg.contains("connection refused") || msg.contains("Connection refused") {
        "无法连接到 API 服务器，请检查 Base URL 是否正确".into()
    } else if msg.contains("network") || msg.contains("Network") {
        "网络连接失败，请检查网络状态".into()
    } else {
        // 其他错误，显示原始信息帮助排查
        format!("请求失败：{}", msg)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开函数：测试 AI 连接
// ─────────────────────────────────────────────────────────────────────────────

/// 测试 AI 连接是否正常
///
/// 只发一个最简单的请求，验证：
/// 1. 网络连通
/// 2. API Key 有效
/// 3. 模型名称正确
/// 4. 没有额度/过期等问题
///
/// 不做完整 JD 解析，只验证 HTTP 层面是否成功
pub async fn test_connection(config: &AiProviderConfig) -> TestConnectionResult {
    // 发最简请求，不走完整 prompt
    let messages = vec![("user", json!("hi"))];

    match call_ai(
        &config.provider,
        &config.api_key,
        config.base_url.as_deref().unwrap_or(""),
        &config.model,
        messages,
    )
    .await
    {
        Ok(_) => TestConnectionResult {
            success: true,
            message: "API 连接成功！密钥有效，模型正常".into(),
        },
        Err(e) => TestConnectionResult {
            success: false,
            message: parse_ai_error(&e),
        },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开函数：生成面试题
// ─────────────────────────────────────────────────────────────────────────────

/// 根据 JD 生成面试问题
///
/// 让 AI 基于 JD 生成 5 道最可能的面试题，
/// 返回 JSON 数组，每项包含问题、类型、难度和回答指导。
pub async fn generate_interview_questions(
    jd_content: &str,
    config: &AiProviderConfig,
) -> Result<Vec<Value>, AppError> {
    let system_msg = "You are a senior interviewer and career coach. Generate exactly 5 most likely interview questions based on the job description. Always respond with valid JSON only.";
    let user_msg = format!(
        "基于以下JD，生成5个最可能的面试问题，返回JSON数组：\n\nJD内容：\n{}\n\n输出格式（严格JSON数组，不要其他文字）：\n[\n  {{\n    \"question\": \"问题文本\",\n    \"type\": \"技术面|行为面|业务面\",\n    \"difficulty\": \"简单|中等|困难\",\n    \"guidance\": {{\n      \"考察点\": \"核心考察点描述\",\n      \"回答策略\": \"回答策略建议\",\n      \"参考答案\": \"参考答案要点\",\n      \"应答重点\": \"应答重点提示\"\n    }}\n  }}\n]",
        jd_content
    );

    let messages = vec![
        ("system", json!(system_msg)),
        ("user", json!(user_msg)),
    ];

    let content = call_ai(
        &config.provider,
        &config.api_key,
        config.base_url.as_deref().unwrap_or(""),
        &config.model,
        messages,
    )
    .await?;

    if content.is_empty() {
        return Err(AppError::Ai("AI returned empty response".into()));
    }

    // 从响应中提取 JSON 数组
    if let Ok(re) = Regex::new(r"\[[\s\S]*\]") {
        if let Some(m) = re.find(&content) {
            match serde_json::from_str::<Vec<Value>>(m.as_str()) {
                Ok(questions) => return Ok(questions),
                Err(_) => {}
            }
        }
    }

    Err(AppError::Ai(
        "Failed to parse interview questions from AI response".into(),
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开函数：图片 JD 解析
// ─────────────────────────────────────────────────────────────────────────────

/// 解析图片中的 JD（OCR + 理解）
///
/// 支持两种格式：
/// - **Anthropic**: 用 vision API，支持图片直接发送
/// - **OpenAI 兼容**: 用 gpt-4o 等多模态模型，发送 data URL
///
/// # 参数
/// - `image_base64`: 图片的 base64 编码（可能是 data URL 格式）
/// - `filename`: 文件名，用于判断是 PDF 还是图片
/// - `config`: AI 配置
pub async fn parse_image_jd(
    image_base64: &str,
    filename: &str,
    config: &AiProviderConfig,
) -> Result<String, AppError> {
    // 优先用多模态模型，没配就用主模型
    let model_to_use = config
        .multimodal_model
        .as_deref()
        .unwrap_or(&config.model);

    // 去掉 data URL 前缀（如果有的话）
    // data:image/jpeg;base64,/9j/4AAQ... -> /9j/4AAQ...
    let raw_base64 = if let Some(idx) = image_base64.find(',') {
        &image_base64[idx + 1..]
    } else {
        image_base64
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    // 判断是 PDF 还是图片，从原始 data URL 中提取正确的媒体类型
    // 如果原始 base64 是 data URL 格式（data:image/png;base64,...），从其中提取类型
    // 否则根据文件扩展名判断
    let media_type = if let Some(idx) = image_base64.find("data:") {
        if let Some(end_idx) = image_base64[idx..].find(';') {
            let maybe_type = &image_base64[idx + 5..end_idx];
            // 验证是有效的 MIME 类型（包含 /）
            if maybe_type.contains('/') {
                maybe_type.to_string()
            } else if filename.ends_with(".pdf") {
                "application/pdf".to_string()
            } else {
                // 回退到根据扩展名判断
                if filename.to_lowercase().ends_with(".png") {
                    "image/png".to_string()
                } else {
                    "image/jpeg".to_string()
                }
            }
        } else if filename.ends_with(".pdf") {
            "application/pdf".to_string()
        } else {
            "image/jpeg".to_string()
        }
    } else if filename.ends_with(".pdf") {
        "application/pdf".to_string()
    } else {
        // 根据文件扩展名判断
        if filename.to_lowercase().ends_with(".png") {
            "image/png".to_string()
        } else {
            "image/jpeg".to_string()
        }
    };

    let text_prompt = "请分析这张图片中的职位描述（JD），返回纯文本内容。如果图片不是JD，请说明。";

    // ─── Anthropic 兼容协议图片格式 ───
    if config.provider == "anthropic_compatible" {
        let image_block = json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": raw_base64,
            }
        });
        let text_block = json!({
            "type": "text",
            "text": text_prompt,
        });

        let body = json!({
            "model": model_to_use,
            "max_tokens": 4096,
            "messages": [{
                "role": "user",
                "content": [image_block, text_block]
            }]
        });

        let base_url = config
            .base_url
            .as_deref()
            .unwrap_or("");

        let resp = client
            .post(format!("{}/messages", base_url))
            .header("Content-Type", "application/json")
            .header("x-api-key", &config.api_key)                                       // 官方 Anthropic 认证
            .header("Authorization", format!("Bearer {}", &config.api_key))             // 火山引擎等第三方认证
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("Anthropic vision error: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "Anthropic vision error: {} - {}",
                status,
                &text[..text.len().min(300)]
            )));
        }

        let data: Value = resp.json().await.map_err(|e| AppError::Ai(e.to_string()))?;
        let extracted = data
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.iter().find(|item| item.get("type").and_then(|t| t.as_str()) == Some("text")))
            .and_then(|item| item.get("text"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                AppError::Ai(format!(
                    "Failed to extract content from Anthropic response: {}",
                    serde_json::to_string(&data).unwrap_or_default()
                ))
            })?;

        // 检查是否说图片不是 JD
        if extracted.contains("不是") && extracted.contains("JD") {
            return Err(AppError::Ai(
                "图片中未找到职位描述内容，请上传包含JD的图片或截图".into(),
            ));
        }

        Ok(extracted)
    }
    // ─── OpenAI 兼容图片格式 ───
    else {
        // OpenAI 兼容格式用 data URL
        let data_uri = format!("data:{};base64,{}", media_type, raw_base64);

        let body = json!({
            "model": model_to_use,
            "messages": [{
                "role": "user",
                "content": [
                    { "type": "image_url", "image_url": { "url": data_uri } },
                    { "type": "text", "text": text_prompt }
                ]
            }],
            "max_tokens": 4096
        });

        let base = Regex::new(r"/chat/completions/?$")
            .unwrap()
            .replace_all(
                config.base_url.as_deref().unwrap_or(""),
                "",
            )
            .to_string();

        let resp = client
            .post(format!("{}/chat/completions", base))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", &config.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("AI vision error: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "AI vision error: {} - {}",
                status,
                &text[..text.len().min(300)]
            )));
        }

        let data: Value = resp.json().await.map_err(|e| AppError::Ai(e.to_string()))?;
        let extracted = data
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                AppError::Ai(format!(
                    "Failed to extract content from API response: {}",
                    serde_json::to_string(&data).unwrap_or_default()
                ))
            })?;

        // 检查是否说图片不是 JD
        if extracted.contains("不是") && extracted.contains("JD") {
            return Err(AppError::Ai(
                "图片中未找到职位描述内容，请上传包含JD的图片或截图".into(),
            ));
        }

        Ok(extracted)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 数据库辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/// 从数据库获取当前激活的 AI 配置
///
/// 供其他模块（commands）调用，获取当前启用的 AI 提供商配置
///
/// # 返回
/// - Ok(AiProviderConfig): 当前激活的配置（包含完整 api_key）
/// - Err(AppError::Ai): 没有激活的配置
pub fn fetch_active_config(
    conn: &rusqlite::Connection,
) -> Result<AiProviderConfig, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, provider, api_key, base_url, model, multimodal_model, is_active, created_at FROM ai_provider_config WHERE is_active = 1",
    )?;

    let config = stmt
        .query_row([], |row| AiProviderConfig::from_row(row))
        .map_err(|_| AppError::Ai(get_active_config_text()))?;

    Ok(config)
}

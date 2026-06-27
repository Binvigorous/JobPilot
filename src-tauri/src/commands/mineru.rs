//! # MinerU API 模块 (精准解析版)
//!
//! 使用 MinerU 精准解析 API 提取图片/PDF 中的文本内容。
//!
//! 流程：
//! 1. POST /v4/file-urls/batch 获取上传URL (带Bearer Token)
//! 2. PUT 文件到 OSS
//! 3. 轮询 GET /v4/extract-results/batch/{batch_id} 直到 done
//! 4. 下载 ZIP 包
//! 5. 解压提取 full.md
//! 6. 返回 Markdown 文本

use crate::error::AppError;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;

const MINERU_API_BASE: &str = "https://mineru.net/api/v4";

/// MinerU 设置结构
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct MinerUSettings {
    pub api_key: String,
    pub model_version: String,
}

/// 获取 MinerU 设置文件路径
fn get_settings_path() -> PathBuf {
    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let config_dir = app_data.join("jobpilot");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("mineru_settings.json")
}

/// 从文件加载 MinerU 设置
fn load_settings() -> Result<MinerUSettings, AppError> {
    let path = get_settings_path();
    if !path.exists() {
        return Ok(MinerUSettings::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| AppError::Ai(format!("Failed to read MinerU settings: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::Ai(format!("Failed to parse MinerU settings: {}", e)))
}

/// 保存 MinerU 设置到文件
fn save_settings(settings: &MinerUSettings) -> Result<(), AppError> {
    let path = get_settings_path();
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| AppError::Ai(format!("Failed to serialize MinerU settings: {}", e)))?;
    let mut file = fs::File::create(&path)
        .map_err(|e| AppError::Ai(format!("Failed to create MinerU settings file: {}", e)))?;
    file.write_all(content.as_bytes())
        .map_err(|e| AppError::Ai(format!("Failed to write MinerU settings: {}", e)))?;
    Ok(())
}

/// 获取 API Token（从设置文件）
fn get_api_token() -> Result<String, AppError> {
    let settings = load_settings()?;
    if settings.api_key.is_empty() {
        return Err(AppError::Ai(
            "MinerU API token not configured. Please set it in AI Settings > MinerU.".to_string()
        ));
    }
    Ok(settings.api_key)
}

/// MinerU API 响应 - 批量获取上传URL
#[derive(Debug, Deserialize)]
struct BatchUploadResponse {
    code: i32,
    msg: String,
    data: Option<BatchUploadData>,
}

#[derive(Debug, Deserialize)]
struct BatchUploadData {
    batch_id: String,
    file_urls: Vec<String>,
}

/// MinerU API 响应 - 批量查询结果
#[derive(Debug, Deserialize)]
struct BatchResultResponse {
    code: i32,
    msg: String,
    data: Option<BatchResultData>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct BatchResultData {
    batch_id: String,
    extract_result: Vec<FileResult>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FileResult {
    file_name: String,
    state: String,
    full_zip_url: Option<String>,
    err_msg: Option<String>,
}

/// 获取签名上传URL
async fn get_signed_upload_url(
    filename: &str,
    api_token: &str,
) -> Result<(String, String), AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    #[derive(Serialize)]
    struct FileInfo {
        name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        data_id: Option<String>,
    }

    #[derive(Serialize)]
    struct RequestBody {
        files: Vec<FileInfo>,
        model_version: String,
        enable_table: bool,
        enable_formula: bool,
        language: String,
    }

    let body = RequestBody {
        files: vec![FileInfo {
            name: filename.to_string(),
            data_id: Some("jobpilot".to_string()),
        }],
        model_version: "vlm".to_string(),
        enable_table: true,
        enable_formula: true,
        language: "ch".to_string(),
    };

    let resp = client
        .post(format!("{}/file-urls/batch", MINERU_API_BASE))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_token))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Ai(format!("MinerU request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Ai(format!(
            "MinerU upload URL request failed: {} - {}",
            status, text
        )));
    }

    let result: BatchUploadResponse =
        resp.json()
            .await
            .map_err(|e| AppError::Ai(format!("Failed to parse MinerU response: {}", e)))?;

    if result.code != 0 {
        return Err(AppError::Ai(format!(
            "MinerU API error: {} - {}",
            result.code, result.msg
        )));
    }

    let data = result.data.ok_or_else(|| {
        AppError::Ai("MinerU response missing data".to_string())
    })?;

    if data.file_urls.is_empty() {
        return Err(AppError::Ai("MinerU returned no file URLs".to_string()));
    }

    Ok((data.batch_id, data.file_urls.into_iter().next().unwrap()))
}

/// 上传文件到 OSS
async fn upload_to_oss(file_url: &str, data: &[u8]) -> Result<(), AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    let resp = client
        .put(file_url)
        .body(data.to_vec())
        .send()
        .await
        .map_err(|e| AppError::Ai(format!("OSS upload failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Ai(format!(
            "OSS upload failed: {} - {}",
            status, text
        )));
    }

    Ok(())
}

/// 轮询查询解析结果
async fn poll_batch_result(batch_id: &str, api_token: &str) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    let max_wait = 120; // 最多等120秒
    let poll_interval = 3; // 每3秒轮询一次
    let max_attempts = max_wait / poll_interval;

    for attempt in 0..max_attempts {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_secs(poll_interval)).await;
        }

        let resp = client
            .get(format!("{}/extract-results/batch/{}", MINERU_API_BASE, batch_id))
            .header("Authorization", format!("Bearer {}", api_token))
            .send()
            .await
            .map_err(|e| AppError::Ai(format!("MinerU query failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!(
                "MinerU query request failed: {} - {}",
                status, text
            )));
        }

        let result: BatchResultResponse = resp.json().await.map_err(|e| {
            AppError::Ai(format!(
                "Failed to parse MinerU query response: {}",
                e
            ))
        })?;

        if result.code != 0 {
            return Err(AppError::Ai(format!(
                "MinerU query API error: {} - {}",
                result.code, result.msg
            )));
        }

        let data = result.data.ok_or_else(|| {
            AppError::Ai("MinerU query response missing data".to_string())
        })?;

        if data.extract_result.is_empty() {
            continue;
        }

        let file_result = &data.extract_result[0];

        match file_result.state.as_str() {
            "done" => {
                let zip_url = file_result.full_zip_url.as_ref().ok_or_else(|| {
                    AppError::Ai("MinerU done but no full_zip_url".to_string())
                })?;
                return Ok(zip_url.to_string());
            }
            "failed" => {
                let err_msg = file_result.err_msg.as_deref().unwrap_or("Unknown error");
                return Err(AppError::Ai(format!("MinerU parsing failed: {}", err_msg)));
            }
            "pending" | "running" | "waiting-file" | "converting" => {
                eprintln!(
                    "[MinerU] State: {}, attempt {}/{}",
                    file_result.state,
                    attempt + 1,
                    max_attempts
                );
                continue;
            }
            _ => {
                return Err(AppError::Ai(format!("Unknown MinerU state: {}", file_result.state)));
            }
        }
    }

    Err(AppError::Ai("MinerU parsing timeout".to_string()))
}

/// 下载并解压 ZIP，提取 full.md
async fn download_and_extract_markdown(zip_url: &str) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Ai(e.to_string()))?;

    eprintln!("[MinerU] Downloading ZIP from: {}", zip_url);

    let resp = client
        .get(zip_url)
        .send()
        .await
        .map_err(|e| AppError::Ai(format!("ZIP download failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        return Err(AppError::Ai(format!("ZIP download failed: {}", status)));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::Ai(format!("Failed to read ZIP bytes: {}", e)))?;

    eprintln!("[MinerU] ZIP downloaded, size: {} bytes", bytes.len());

    // 解压 ZIP
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::Ai(format!("Failed to read ZIP archive: {}", e)))?;

    // 查找 full.md
    let mut full_md_content = String::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| {
            AppError::Ai(format!("Failed to read ZIP entry {}: {}", i, e))
        })?;

        let name = file.name().to_string();
        eprintln!("[MinerU] ZIP entry: {}", name);

        if name == "full.md" || name.ends_with("/full.md") {
            file.read_to_string(&mut full_md_content).map_err(|e| {
                AppError::Ai(format!("Failed to read full.md: {}", e))
            })?;
            eprintln!(
                "[MinerU] Found full.md, content length: {}",
                full_md_content.len()
            );
            break;
        }
    }

    if full_md_content.is_empty() {
        return Err(AppError::Ai("full.md not found in ZIP".to_string()));
    }

    Ok(full_md_content)
}

/// 解析图片/PDF 文件
///
/// 将图片/PDF 内容发送给 MinerU API 进行解析，
/// 返回提取的 Markdown 文本。
///
/// # 参数
/// - `file_base64`: 文件的 base64 编码（可能是 data URL 格式）
/// - `filename`: 文件名（含扩展名），用于判断文件类型
/// - `api_token`: MinerU API Token（可选，不传则从环境变量读取）
///
/// # 返回
/// 解析后的 Markdown 文本
#[tauri::command]
pub async fn mineru_parse(
    file_base64: String,
    filename: String,
    api_token: Option<String>,
) -> Result<String, String> {
    // 获取 API Token
    let token = if let Some(t) = api_token {
        t
    } else {
        get_api_token().map_err(|e| e.to_string())?
    };

    // 解析 base64 数据
    let file_data = if let Some(idx) = file_base64.find(',') {
        let data = &file_base64[idx + 1..];
        BASE64.decode(data).map_err(|e| format!("Failed to decode base64: {}", e))?
    } else {
        BASE64.decode(&file_base64).map_err(|e| format!("Failed to decode base64: {}", e))?
    };

    if file_data.is_empty() {
        return Err("Empty file data".to_string());
    }

    eprintln!(
        "[MinerU] Starting parse for file: {} ({} bytes)",
        filename,
        file_data.len()
    );

    // 获取签名上传 URL
    let (batch_id, file_url) = get_signed_upload_url(&filename, &token)
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[MinerU] Got batch_id: {}, uploading...", batch_id);

    // 上传到 OSS
    upload_to_oss(&file_url, &file_data)
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[MinerU] File uploaded, polling for result...");

    // 轮询结果
    let zip_url = poll_batch_result(&batch_id, &token)
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[MinerU] Parsing done, downloading and extracting markdown...");

    // 下载并解压 ZIP
    let markdown = download_and_extract_markdown(&zip_url)
        .await
        .map_err(|e| e.to_string())?;

    if markdown.len() < 20 {
        return Err("Extracted content too short, please try a clearer image".to_string());
    }

    eprintln!("[MinerU] Done, extracted {} chars", markdown.len());

    Ok(markdown)
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开命令：MinerU 设置管理
// ─────────────────────────────────────────────────────────────────────────────

/// 获取 MinerU 设置
#[tauri::command]
pub fn mineru_get_settings() -> Result<Option<String>, String> {
    match load_settings() {
        Ok(settings) => {
            if settings.api_key.is_empty() {
                Ok(None)
            } else {
                Ok(Some(serde_json::to_string(&settings).map_err(|e| e.to_string())?))
            }
        }
        Err(_) => Ok(None),
    }
}

/// 保存 MinerU 设置
#[tauri::command]
pub fn mineru_save_settings(settings: String) -> Result<(), String> {
    let settings: MinerUSettings = serde_json::from_str(&settings)
        .map_err(|e| format!("Invalid settings format: {}", e))?;
    save_settings(&settings).map_err(|e| e.to_string())
}

/// 测试 MinerU 连接（使用编译时内嵌的 JD.png 进行完整测试）
///
/// 使用 include_bytes! 在编译时将测试图片嵌入二进制文件，
/// 确保在任何运行环境（开发/安装版/DMG）下都能正常工作，
/// 不依赖运行时的文件系统路径。
#[tauri::command]
pub async fn mineru_test(api_token: String, _app_handle: tauri::AppHandle) -> Result<String, String> {
    if api_token.is_empty() {
        return Err("API Token is required".to_string());
    }

    // 编译时嵌入测试图片，路径相对于此源文件
    // mineru.rs 位于 src-tauri/src/commands/，上三级为项目根目录
    const TEST_IMAGE: &[u8] = include_bytes!("../../../data/JD.png");

    eprintln!("[MinerU Test] 使用内嵌测试图片（{} bytes）进行完整测试", TEST_IMAGE.len());

    let file_base64 = BASE64.encode(TEST_IMAGE);

    // 调用 mineru_parse 进行完整测试
    match mineru_parse(file_base64, "JD.png".to_string(), Some(api_token)).await {
        Ok(content) => {
            let len = content.len();
            let preview = if content.len() > 200 {
                format!("{}...", &content[..200])
            } else {
                content.clone()
            };
            Ok(format!("✅ 连接成功！解析到 {} 个字符\n\n预览：\n{}", len, preview))
        }
        Err(e) => Err(format!("❌ 测试失败：{}", e)),
    }
}

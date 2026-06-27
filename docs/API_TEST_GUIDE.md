# JobPilot API 测试指南

## 应用说明

JobPilot 是一个基于 Tauri v2 的 macOS 原生求职管理系统，支持灵活接入各类大模型 API，现已重构为模块化架构。

---

## 支持的 AI 协议与厂商

### 1️⃣ OpenAI 兼容协议
**端点类型**: `/chat/completions`  
**认证方式**: `Authorization: Bearer {API_KEY}`

支持的厂商：
- **OpenAI** - https://api.openai.com/v1
- **DeepSeek** - https://api.deepseek.com/v1
- **智谱 AI** - https://open.bigmodel.cn/api/paas/v4
- **月之暗面（Kimi）** - https://api.moonshot.cn/v1
- **火山引擎 Ark** - https://ark.cn-beijing.volces.com/api/v3
- **豆包** - https://ark.cn-beijing.volces.com/api/v3
- **MiniMax** - https://api.minimax.chat/v1

### 2️⃣ Anthropic 兼容协议
**端点类型**: `/messages`  
**认证方式**: `x-api-key: {API_KEY}`

支持的厂商：
- **Anthropic Official** - https://api.anthropic.com/v1
- **火山引擎 Anthropic 协议** - https://ark.cn-beijing.volces.com/api/v3

---

## 快速开始：添加 AI 配置

### 步骤 1：打开应用
1. 运行已打包的 DMG 应用
2. 点击右上角 ⚙️ **Settings** 按钮
3. 选择 **AI Config** 标签

### 步骤 2：添加新配置
1. 点击 **+ Add New Config** 按钮
2. 填写以下字段：

#### 必填字段
- **Config Name**: 配置名称，例如 `My DeepSeek`
- **Protocol**: 选择协议类型
  - `OpenAI Compatible` - 大多数国内厂商
  - `Anthropic Compatible` - Anthropic 官方或兼容服务
- **Base URL**: API 端点地址，例如 `https://api.deepseek.com/v1`
- **Model**: 模型名称，例如 `deepseek-chat`
- **API Key**: 你的 API 密钥

#### 可选字段
- **Multimodal Model**: 支持图片的模型名称（用于图片 JD 解析）

### 步骤 3：测试连接
1. 填写完配置后，点击 **🔌 Test Connection** 按钮
2. 应该显示绿色 ✅ 提示，表示连接成功
3. 如果失败，检查：
   - API Key 是否正确
   - Base URL 是否包含正确的协议端点
   - 模型名称是否存在
   - 网络连接是否正常

### 步骤 4：激活配置
1. 点击 **Activate** 按钮，使该配置为当前活跃配置
2. 被激活的配置会显示 ⭐ 标记

---

## 推荐测试方案

### 测试方案 1：免费/试用额度（推荐入门）
#### 使用 DeepSeek API
```
Config Name: DeepSeek (Free Trial)
Protocol: OpenAI Compatible
Base URL: https://api.deepseek.com/v1
Model: deepseek-chat
API Key: (从 https://platform.deepseek.com 获取)
```
✅ **优势**：
- 新用户有 500 万 token 免费额度
- API 价格便宜
- 模型性能好，中文支持好

#### 使用月之暗面（Kimi）
```
Config Name: Kimi (Free Trial)
Protocol: OpenAI Compatible
Base URL: https://api.moonshot.cn/v1
Model: moonshot-v1-8k
API Key: (从 https://platform.moonshot.cn 获取)
```

### 测试方案 2：企业级方案
#### 使用 OpenAI API
```
Config Name: OpenAI GPT-4
Protocol: OpenAI Compatible
Base URL: https://api.openai.com/v1
Model: gpt-4-turbo
API Key: sk-xxxxxxxx
```

#### 使用 Anthropic Claude
```
Config Name: Anthropic Claude
Protocol: Anthropic Compatible
Base URL: https://api.anthropic.com/v1
Model: claude-3-opus-20240229
API Key: sk-ant-xxxxxxxx
```

---

## 使用指南

### 创建新职位（触发 AI 解析）
1. 点击 **+ New Job** 按钮
2. 在 **Job Description (JD)** 字段粘贴职位描述
3. 选择 **Auto-parse with AI** 复选框
4. 点击 **Create Job**
5. 系统会自动调用配置的 AI 服务：
   - 📄 提取职位字段（标题、公司、薪资等）
   - 🔑 提取关键词（技术栈、核心能力等）
   - 🎯 分析职位类型和难度
   - 📋 生成面试准备指南

### 图片 JD 解析
1. 在职位详情页，点击 **📸 Upload Image** 按钮
2. 选择包含职位描述的截图或 PDF
3. 系统使用配置的**多模态模型**进行 OCR + 理解：
   - 自动识别图片中的文字
   - 转换为可编辑的 JD 内容

### 生成面试题
1. 在职位详情页，点击 **🎓 Generate Interview Questions** 按钮
2. AI 将根据 JD 生成 5 个最可能的面试题，包括：
   - 问题文本
   - 问题类型（技术面/行为面/业务面）
   - 难度等级
   - 回答指导

---

## 故障排查

### 常见问题

#### ❌ 错误：`API Key 无效或已过期`
- **原因**：API Key 不正确或已失效
- **解决**：
  - 检查 API Key 是否完整复制
  - 登录对应平台确认 Key 未被禁用
  - 尝试重新生成新的 API Key

#### ❌ 错误：`API 地址或模型名称错误`
- **原因**：Base URL 或 Model 配置不对
- **解决**：
  - 确保 Base URL 不包含 `/chat/completions` 等端点
  - 检查模型名称是否存在（可在平台文档查看）
  - 尝试去掉末尾的 `/` 符号

#### ❌ 错误：`无法连接到 API 服务器`
- **原因**：网络问题或 URL 错误
- **解决**：
  - 检查网络连接
  - 尝试在浏览器中访问 Base URL，看是否可访问
  - 某些 API 可能需要科学上网（如 OpenAI）

#### ❌ 错误：`请求被限流或额度已用完`
- **原因**：API 调用频率过高或账户额度用完
- **解决**：
  - 稍后重试
  - 检查账户余额或是否有额度限制
  - 选择有免费额度的厂商进行测试

#### ❌ 错误：`AI returned empty response`
- **原因**：AI 服务返回空响应或格式不对
- **解决**：
  - 确保 JD 内容完整且格式正确
  - 尝试使用不同的职位描述
  - 检查选中的模型是否支持中文

---

## 各厂商 API 获取指南

### 🔗 DeepSeek
1. 访问 https://platform.deepseek.com
2. 注册账户
3. 充值或等待免费额度
4. 点击 **API Keys** 获取密钥
5. 复制 Key，粘贴到 JobPilot

### 🔗 月之暗面（Kimi）
1. 访问 https://platform.moonshot.cn
2. 注册账户
3. 申请 API 访问权限
4. 生成新的 API Key
5. 复制 Key 到 JobPilot

### 🔗 OpenAI
1. 访问 https://platform.openai.com
2. 登录或注册
3. 点击 **API Keys**
4. 创建新的 Secret Key
5. 需要绑定支付方式才能使用

### 🔗 Anthropic
1. 访问 https://console.anthropic.com
2. 登录或注册
3. 点击 **API Keys**
4. 创建新 Key
5. 复制 Key 到 JobPilot

---

## 性能建议

| 厂商 | 模型 | 速度 | 成本 | 中文 | 多模态 |
|-----|------|------|------|------|---------|
| DeepSeek | deepseek-chat | ⚡ 快 | 💰 便宜 | ✅ 优秀 | ✅ 支持 |
| 月之暗面 | moonshot-v1-8k | ⚡ 快 | 💰 便宜 | ✅ 优秀 | ❌ 不支持 |
| 智谱 AI | glm-4 | ⚡⚡ 中速 | 💰 中等 | ✅ 优秀 | ✅ 支持 |
| OpenAI | gpt-4-turbo | ⚡⚡⚡ 中速 | 💸 昂贵 | ✅ 良好 | ✅ 支持 |
| Anthropic | claude-3-opus | ⚡⚡⚡ 中速 | 💸 昂贵 | ✅ 良好 | ✅ 支持 |

---

## 测试提示

✅ **建议先测试**：
1. 从 DeepSeek 或 Kimi 开始（有免费额度）
2. 先测试简单的 JD 解析
3. 再测试图片 OCR 和面试题生成
4. 确认工作正常后再切换到生产环境

🎯 **测试 JD 样本**：
- 使用 `/data` 目录下的 PDF 文件
- 或复制真实职位描述文本进行测试
- 检查提取的字段是否准确

---

## 快速反馈

如遇到问题，请收集以下信息：
1. ❌ 错误消息（完整的）
2. 🔧 配置信息（不含 API Key）
3. 📋 测试的 JD 内容
4. 🕐 时间戳

这样可以快速定位和解决问题。

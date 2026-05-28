# AI 配置与调用流程

## 问题描述

在使用 JobPilot 的 AI 配置功能时，遇到了 MiniMax API 调用失败的问题：
- MiniMax 官方文档推荐使用 Anthropic API 兼容方式接入
- 配置 `anthropic` provider + baseUrl `https://api.minimaxi.com/anthropic` 后返回 404

## 问题排查

### 1. 官方文档 vs 实际情况

MiniMax 官方文档说明：
```
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
```

但实际测试发现：
```bash
# Anthropic 格式路径 → 404
POST https://api.minimaxi.com/anthropic/messages → 404 page not found

# OpenAI 兼容格式路径 → 成功！
POST https://api.minimaxi.com/v1/chat/completions → 200 OK
```

### 2. 结论

虽然 MiniMax 文档说"通过 Anthropic API 兼容"，但实际上 `/anthropic/messages` 端点**不存在**。真正可用的是 **OpenAI 兼容格式** `/v1/chat/completions`。

### 3. 正确的配置方式

| 字段 | 值 |
|------|-----|
| Provider | `openai` |
| Base URL | `https://api.minimaxi.com/v1` |
| Model | `MiniMax-M2.7` |

## AI 模块架构

### 支持的 AI 提供商

| Provider | API 类型 | 默认 Base URL | 默认 Model |
|----------|----------|---------------|------------|
| `openai` | OpenAI 兼容 | `https://api.openai.com/v1` | `gpt-4o` |
| `anthropic` | Anthropic 格式 | `https://api.anthropic.com/v1` | `claude-sonnet-4-6` |
| `google` | OpenAI 兼容 | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` |
| `deepseek` | OpenAI 兼容 | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `minimax` | Anthropic 格式 | `https://api.minimaxi.com/anthropic` | `MiniMax-M2.7` |

### 两种 API 调用格式

#### 1. Anthropic 格式（`/messages` 端点）
- 用于：anthropic, minimax
- 认证：`x-api-key` header
- system message 映射为 assistant

```rust
POST {base_url}/messages
Headers:
  Content-Type: application/json
  x-api-key: {api_key}
  anthropic-version: 2023-06-01
```

响应格式：
```json
{
  "content": [
    { "type": "text", "text": "..." }
  ]
}
```

#### 2. OpenAI 兼容格式（`/chat/completions` 端点）
- 用于：openai, google, deepseek, 自定义
- 认证：`Authorization: Bearer` header

```rust
POST {base_url}/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer {api_key}
```

响应格式：
```json
{
  "choices": [
    { "message": { "content": "..." } }
  ]
}
```

## 配置保存流程

### 前端 → 后端完整链路

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
│  AISettings.tsx                                                 │
│    handleSubmit() → aiConfigsApi.update(id, input)              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ invoke('ai_config_update')
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tauri IPC 调用                                │
│  ai-config.ts                                                    │
│    invoke() → Rust 后端                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Rust 后端 (src-tauri/)                        │
│                                                                 │
│  commands/ai_config.rs                                          │
│    ai_config_update() → SQL UPDATE → jobpilot.db                │
│                         ai_provider_config 表                    │
└─────────────────────────────────────────────────────────────────┘
```

### 测试连接流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
│  handleTest(id) → aiConfigsApi.test(id)                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ invoke('ai_config_test')
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Rust 后端                                     │
│                                                                 │
│  commands/ai_config.rs                                          │
│    ai_config_test() → fetch_active_config() → SQLite 读取配置   │
│                            ↓                                     │
│                    ai.rs                                        │
│                      call_ai(provider, api_key, base_url, model)│
│                            ↓                                     │
│                      HTTP 请求到 AI 提供商                       │
└─────────────────────────────────────────────────────────────────┘
```

## 关键代码位置

| 文件 | 说明 |
|------|------|
| `src/app/pages/AISettings.tsx` | 前端 AI 配置页面 |
| `src/app/api/ai-config.ts` | 前端 API 调用层（invoke） |
| `src-tauri/src/commands/ai_config.rs` | Rust Tauri 命令（CRUD） |
| `src-tauri/src/ai.rs` | AI 调用核心逻辑 |
| `src-tauri/src/db.rs` | 数据库初始化 |
| `src-tauri/src/models.rs` | 数据模型定义 |

## 相关文件

- `src-tauri/src/ai.rs` - 核心 AI 调用逻辑（含详细注释）
- `src-tauri/src/commands/ai_config.rs` - AI 配置的 Tauri 命令
- `src-tauri/src/scraper.rs` - 网页爬虫逻辑

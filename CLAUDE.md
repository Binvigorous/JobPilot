# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本代码库中工作时提供指导。

## 项目概述

JobPilot 是一个基于 Tauri v2 的 macOS 原生桌面求职管理系统，具备 AI 驱动的 JD 解析能力。

- **前端**: Vite + React + TypeScript + Tailwind CSS，静态资源打包进 app
- **后端**: Tauri v2 + Rust，使用 rusqlite 直接操作 SQLite
- **AI 服务**: Rust 端通过 reqwest 调用 OpenAI 兼容 API / Anthropic API
- **数据库**: SQLite，存储在 app data 目录 `jobpilot.db`

## 常用命令

```bash
# 开发（启动 Tauri 桌面应用）
npm run dev

# 构建 macOS 生产版本
npm run build

# 前端单独开发（Vite Dev Server，5173 端口）
npm run dev:frontend

# 旧 Express 后端（已弃用，保留供参考）
npm run dev:backend
```

## 架构要点

### Tauri IPC 调用
前端通过 `invoke()` 调用 Rust 后端命令，命令名使用 snake_case：
- `jobs_list`、`job_get`、`job_create`、`job_update`、`job_delete`、`job_reparse`、`job_generate_interview_questions`
- `ai_config_list`、`ai_config_get_active`、`ai_config_create`、`ai_config_update`、`ai_config_activate`、`ai_config_delete`、`ai_config_test`
- `scrape_url`、`scrape_image`

### 数据库（SQLite）
- 数据库文件位于 Tauri app data 目录（自动创建）
- JSON 字段（`jdParsedContent`、`keywords`、`interviewQuestions`、`roleAnalysis`、`interviewInsights`、`preparationGuide`）存储为 TEXT 列，内容是 JSON 字符串。读取时需要 `JSON.parse()`
- SQLite 用 INTEGER (0/1) 存储布尔值（`isActive`）

### AI 服务（`src-tauri/src/ai.rs`）
`call_ai()` 函数支持多种 AI 提供商：
- **OpenAI 兼容**（OpenAI、DeepSeek、Google、custom）：使用 `/chat/completions` 端点，支持 `response_format: json_object`
- **Anthropic**：使用 `/messages` 端点，请求格式不同（base64 图片、system 映射为 assistant）

### 爬取策略（`src-tauri/src/scraper.rs`）
爬虫根据 URL 主机名识别招聘平台类型，使用对应的 CSS 选择器。
支持平台：zhipin.com（BOSS直聘）、zhilian.com（智联招聘）、51job.com（前程无忧）、lagou.com（拉勾网）、liepin.com（猎聘网）。无法匹配时回退到正文提取。

## 项目结构

```
JobPilot/
├── src/                      # React 前端
│   ├── app/
│   │   ├── api/             # Tauri invoke 调用（已从 fetch 迁移）
│   │   │   ├── jobs.ts      # 岗位 CRUD + 爬取
│   │   │   └── ai-config.ts # AI 配置管理
│   │   ├── components/      # React 组件
│   │   └── pages/          # 页面组件
│   └── main.tsx
├── src-tauri/               # Tauri v2 + Rust 后端
│   ├── src/
│   │   ├── lib.rs          # Tauri Builder 入口
│   │   ├── state.rs        # AppState (Mutex<Connection>)
│   │   ├── db.rs           # 数据库初始化
│   │   ├── models.rs       # Rust struct + serde
│   │   ├── error.rs        # AppError 枚举
│   │   ├── ai.rs           # AI 服务（parseJD, testConnection 等）
│   │   ├── scraper.rs      # 网页爬虫
│   │   └── commands/       # Tauri 命令
│   │       ├── jobs.rs
│   │       ├── ai_config.rs
│   │       └── scrape.rs
│   └── tauri.conf.json
├── server/                  # 旧 Express 后端（已弃用，保留供参考）
└── changelog/               # 开发日志
```

## 关键 Rust 模块说明

- `ai.rs` — 核心 AI 调用逻辑，支持 OpenAI 兼容和 Anthropic 两种 API 格式
- `scraper.rs` — 从 URL 提取 JD 内容，5 个招聘平台策略 + fallback
- `commands/jobs.rs` — 岗位 CRUD，其中 `job_create` 和 `job_reparse` 会在后台异步调用 AI
- `commands/ai_config.rs` — AI 配置管理，list/get 接口会对 apiKey 做掩码处理
- `commands/scrape.rs` — 爬取 URL 和解析图片

## 开发日志规范

每次完成 bug 修复或功能优化后，按以下规则维护日志文件。

### 文件结构

日志统一存放在项目根目录 `changelog/` 下，按月命名：`changelog/YYYY-MM.md`。

### 写入前必须执行的检查

1. **去重检查**：读取当月文件内容，如果本次改动与已有某条记录的"文件 + 问题描述"高度相似，跳过，不重复追加。
2. **反复出现检查**：如果是对同一问题的再次修复（相同模块、相同问题），不新增条目，在原条目下追加一行：
   `- **再次修复**：[日期] 原因/补充说明`

只有确认是新问题或新优化时，才写入新条目。

### 文件格式

```markdown
# YYYY-MM 开发日志

## 模块名

### [YYYY-MM-DD] bugfix/optimization/feature：简要标题
- **问题**：一句话描述原来的问题或需求
- **改动**：一句话描述做了什么，多项用顿号分隔
- **文件**：`路径/文件名`

---

## 另一个模块名

### [YYYY-MM-DD] bugfix：简要标题
- **问题**：...
- **改动**：...
- **文件**：`路径/文件名`
```

注意事项：
- 类型（bugfix/optimization/feature）只写在标题中，正文不重复
- `---` 只加在模块之间，模块内多个条目之间不加
- 模块名直接写，不加方括号
- 改动描述保持单行，多项内容用顿号分隔，不使用子列表

### 模块归属判断规则

- 根据涉及文件的目录路径判断模块，例如 `src/auth/` → `auth`
- 如果涉及多个模块，在各自模块下分别写一条，注明"关联改动"
- 全局性改动（如构建配置、公共工具）归入 `common` 模块
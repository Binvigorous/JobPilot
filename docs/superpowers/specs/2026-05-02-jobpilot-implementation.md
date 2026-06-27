# JobPilot 实施计划

## Context

基于 Figma Make 导出的 Vite + React Router 前端项目，补全缺失的入口文件和配置，删除 Figma 无用文件，并搭建 Express + Prisma + SQLite 后端 API 服务，实现完整的求职管理工具。

## 架构概览

```
Vite 前端 (port 5173)  ←→  Express API (port 3001)
                            ├── /api/jobs         岗位 CRUD + AI 解析
                            ├── /api/ai-config    AI 配置管理
                            ├── /api/scrape       链接爬取
                            └── Prisma → SQLite
```

## 技术栈

- **前端**：Vite + React Router + shadcn/ui（Figma Make 导出）
- **后端**：Express + Prisma + SQLite（独立 API 服务）
- **部署**：本地运行，concurrently 同时启动前后端
- **通信**：Vite dev proxy 将 `/api` 请求代理到 Express 后端

---

## Phase 1：修复前端，使其可运行

### 1.1 已完成：删除 Figma 无用文件

| 文件/目录 | 操作 |
|-----------|------|
| `default_shadcn_theme.css` | 已删除 |
| `src/app/components/figma/` | 已删除 |
| `src/styles/fonts.css` | 已删除 |
| `ATTRIBUTIONS.md` | 已删除 |
| `src/styles/index.css` | 已移除对 `fonts.css` 的 import |

### 1.2 已完成：补全缺失的入口文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `index.html` | 新建 | Vite HTML 入口，引用 `main.tsx` |
| `src/main.tsx` | 新建 | React 根渲染入口，引入样式 + 渲染 `<App />` |

### 1.3 已完成：补全配置文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `tsconfig.json` | 新建 | TypeScript 配置，路径别名 `@` → `./src` |
| `package.json` | 修改 | 修改 `name` 为 `jobpilot`，添加 `dev`、`preview` 脚本，移动 react/react-dom 到 dependencies |

### 1.4 已完成：安装依赖并验证

- 执行 `pnpm install` 安装依赖
- 执行 `npx vite build` 验证构建成功

---

## Phase 2：搭建后端 API 服务

### 2.1 初始化后端项目

- 创建 `server/` 目录结构：`src/routes/`、`src/services/`、`prisma/`
- 创建 `server/package.json`（独立的后端包）
- 创建 `server/tsconfig.json`
- 创建 `server/src/index.ts`（Express 入口，CORS 配置，路由挂载，PrismaClient 初始化）

### 2.2 配置 Prisma + SQLite

**`server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./jobpilot.db"
}

model Job {
  id                 String   @id @default(uuid())
  title              String
  company            String
  salary             String?
  location           String?
  experience         String?
  education          String?
  sourceUrl          String?
  sourceText         String?
  jdRawContent       String
  jdParsedContent    String?
  keywords           String?
  preferenceLevel    String   @default("none")
  applicationStatus  String   @default("not_applied")
  recruitmentStatus  String   @default("active")
  interviewDate      String?
  interviewFeedback  String?
  notes              String?
  aiInterviewGuide   String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model AIProviderConfig {
  id        String   @id @default(uuid())
  name      String
  provider  String
  apiKey    String
  baseUrl   String?
  model     String
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

**待执行命令：**
```bash
cd server
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev --name init
```

### 2.3 实现 API 路由

#### `server/src/routes/jobs.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/jobs` | 获取岗位列表，支持筛选（status、preference）、搜索、排序 |
| GET | `/api/jobs/:id` | 获取岗位详情 |
| POST | `/api/jobs` | 创建岗位，可选自动 AI 解析 |
| POST | `/api/jobs/:id/reparse` | 重新触发 AI 解析 |
| PUT | `/api/jobs/:id` | 更新岗位字段 |
| DELETE | `/api/jobs/:id` | 删除岗位 |

#### `server/src/routes/ai-config.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai-config` | 获取配置列表（API Key 脱敏） |
| GET | `/api/ai-config/active` | 获取当前激活配置 |
| POST | `/api/ai-config` | 创建新配置 |
| PUT | `/api/ai-config/:id` | 更新配置 |
| PUT | `/api/ai-config/:id/activate` | 激活配置 |
| DELETE | `/api/ai-config/:id` | 删除配置 |
| POST | `/api/ai-config/:id/test` | 测试连通性 |

#### `server/src/routes/scrape.ts`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/scrape` | 从 URL 爬取 JD 内容，返回提取的正文 |

### 2.4 启动验证

```bash
cd server
pnpm dev  # 启动后端在 http://localhost:3001
```

---

## Phase 3：前后端对接

### 3.1 替换前端 mock 数据为 API 调用

- 创建 `src/app/api/` 目录，封装 fetch 调用
- 修改各页面组件，将 `src/app/data/mockData.ts` 的调用替换为 API 调用
- 删除 `src/app/data/mockData.ts`

### 3.2 配置开发代理

在 `vite.config.ts` 中添加：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
},
```

### 3.3 统一启动脚本

根目录 `package.json` 添加 concurrently：

```bash
pnpm add -D concurrently
```

添加启动脚本：

```json
{
  "scripts": {
    "dev": "concurrently -n \"frontend,backend\" -c \"blue,green\" \"vite\" \"cd server && pnpm dev\"",
    "dev:frontend": "vite",
    "dev:backend": "cd server && pnpm dev"
  }
}
```

---

## Phase 4：实现 AI 解析核心功能

### 4.1 AI 解析 Prompt 设计

在 `server/src/services/ai.ts` 中设计结构化 Prompt，要求 AI 返回 JSON：

```json
{
  "extractedFields": { "title", "company", "salary", "location", "experience", "education" },
  "parsedContent": { "responsibilities": [], "requirements": [] },
  "keywords": { "tech": [], "skills": [], "softSkills": [] },
  "interviewGuide": "面试准备建议..."
}
```

### 4.2 多提供商支持

| provider | 默认 baseUrl | 默认模型 |
|-----------|-------------|---------|
| openai | https://api.openai.com/v1 | gpt-4o |
| anthropic | https://api.anthropic.com/v1 | claude-sonnet-4-6 |
| google | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.0-flash |
| deepseek | https://api.deepseek.com/v1 | deepseek-chat |
| custom | 用户自定义 | 用户自定义 |

### 4.3 链接爬取实现

- 使用原生 `fetch` + `cheerio` 解析 HTML
- 设置合理的 User-Agent 和 Accept-Language 头
- 10 秒超时，失败时返回错误提示引导用户手动粘贴
- 尝试 BOSS 直聘特定选择器，fallback 到全页面文本提取

### 4.4 API Key 安全

- API Key 暂时明文存储（加密存储可后续迭代）
- API Key 在列表接口中脱敏返回（显示前 8 位 + `...`）
- 创建 `server/.env` 和 `server/.env.example`

---

## Phase 5：收尾与优化

### 5.1 错误处理

- 前端：API 调用失败时显示 sonner toast 提示
- 后端：统一错误中间件，返回 `{ error: string }` 格式

### 5.2 加载状态

- 前端：AI 解析过程中显示加载动画（使用 motion 组件）
- 后端：AI 调用设置合理超时

### 5.3 初始化 Git

```bash
git init
```

创建 `.gitignore`：

```
node_modules/
.env
*.db
dist/
.DS_Store
```

首次提交。

---

## 文件变更总览

### 新建文件

```
index.html                          # Vite HTML 入口
src/main.tsx                       # React 根渲染入口
tsconfig.json                      # TypeScript 配置
server/package.json                # 后端包配置
server/tsconfig.json               # 后端 TypeScript 配置
server/src/index.ts                # Express 入口
server/prisma/schema.prisma        # Prisma 数据模型
server/src/routes/jobs.ts          # 岗位 CRUD 路由
server/src/routes/ai-config.ts     # AI 配置路由
server/src/routes/scrape.ts        # 爬虫路由
server/src/services/ai.ts          # AI 解析服务
```

### 删除文件

```
default_shadcn_theme.css
src/app/components/figma/          # 目录
src/styles/fonts.css
ATTRIBUTIONS.md
```

### 修改文件

```
package.json                       # name、scripts、dependencies
src/styles/index.css               # 移除 fonts.css import
pnpm-workspace.yaml                # 添加 server 包
vite.config.ts                     # 添加 proxy 配置（待完成）
src/app/pages/*.tsx                # 替换 mock 为 API 调用（待完成）
```

---

## 验证方式

1. `pnpm dev` 一条命令同时启动前端和后端
2. 访问 `http://localhost:5173`，验证各页面可正常访问
3. 在 AI 配置页面添加一个 AI 提供商，测试连通性
4. 在新增岗位页面粘贴一段 JD 文本，验证 AI 解析结果正确写入数据库
5. 在岗位列表页面验证筛选、搜索、排序功能
6. 在岗位详情页面验证状态管理、面试时间等字段可编辑保存
7. 用 BOSS 直聘链接测试爬取功能（可能因反爬失败，应优雅降级到文本粘贴提示）
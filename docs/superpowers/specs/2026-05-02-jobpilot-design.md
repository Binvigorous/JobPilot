# JobPilot - 求职管理软件设计文档

## Context

个人求职管理工具，用于管理从 BOSS 直聘等平台收集的岗位信息。通过 AI 自动解析 JD 内容，提取面试关键词并生成面试准备建议，帮助用户高效跟踪和管理求职流程。

## 技术栈

- **前端**：Vite + React Router + shadcn/ui（Figma Make 导出，保留复用）
- **后端**：Express + Prisma + SQLite（独立 API 服务）
- **部署**：本地运行，concurrently 同时启动前后端
- **通信**：Vite dev proxy 将 `/api` 请求代理到 Express 后端

## 数据模型

### Job（岗位记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 主键 |
| title | string | 岗位名称 |
| company | string | 公司名 |
| salary | string? | 薪资范围（如 "25-40K"） |
| location | string? | 工作地点 |
| experience | string? | 经验要求（如 "3-5年"） |
| education | string? | 学历要求（如 "本科"） |
| sourceUrl | string? | BOSS 直聘链接 |
| sourceText | string? | 手动粘贴的 JD 文本 |
| jdRawContent | text | AI 解析前的原始 JD 内容（来自爬取或粘贴） |
| jdParsedContent | json | AI 解析后的结构化内容，格式：`{ responsibilities: string[], requirements: string[] }` |
| keywords | json | 提取的面试关键词，格式：`{ tech: string[], skills: string[], softSkills: string[] }` |
| preferenceLevel | enum (high/medium/low/none) | 个人偏好度 |
| applicationStatus | enum (not_applied/applied/interviewing/offer/rejected/withdrawn/eliminated) | 投递状态 |
| recruitmentStatus | enum (active/paused/closed) | 招聘状态 |
| interviewDate | datetime? | 面试时间 |
| interviewFeedback | text? | 面试反馈 |
| notes | text? | 个人备注 |
| aiInterviewGuide | text | AI 生成的面试准备建议 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### AIProviderConfig（AI 提供商配置）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (uuid) | 主键 |
| name | string | 配置名称（如"我的 GPT-4o"） |
| provider | enum (openai/anthropic/google/deepseek/custom) | 提供商 |
| apiKey | string | API Key（加密存储） |
| baseUrl | string? | 自定义 API 端点 |
| model | string | 模型名称（如 gpt-4o、claude-sonnet-4-6） |
| isActive | boolean | 是否为当前激活的配置 |
| createdAt | datetime | 创建时间 |

## 页面与路由

```
/                    → 仪表盘首页
/jobs                → 岗位列表（卡片视图）
/jobs/[id]           → 岗位详情页
/jobs/new            → 新增岗位
/settings/ai-config  → AI 提供商配置
```

### 仪表盘 `/`

- 统计概览：总岗位数、各投递状态数量、近期面试安排
- 最近添加的岗位卡片（最新 5 条）
- 快速添加入口

### 岗位列表 `/jobs`

- 卡片网格布局，每张卡片展示：公司名、岗位、薪资、地点、投递状态、偏好度
- 顶部筛选栏：按投递状态、偏好度、招聘状态筛选
- 搜索框：按公司名/岗位名搜索
- 支持排序（按创建时间、面试时间、偏好度）
- `eliminated` 状态的卡片灰显，默认折叠到列表底部，可通过筛选单独查看
- 支持岗位淘汰标记（`eliminated` 作为投递状态的一种）

### 岗位详情 `/jobs/[id]`

- 顶部：岗位基本信息（公司、岗位、薪资、地点、经验、学历）
- 中部左：JD 解析结果 + 面试关键词标签
- 中部右：AI 面试准备建议
- 底部：管理区域（偏好度、投递状态、招聘状态、面试时间、面试反馈、备注）
- 支持重新触发 AI 解析

### 新增岗位 `/jobs/new`

- 输入方式切换：链接 / 文本粘贴
- 链接输入：粘贴 BOSS 直聘链接，自动爬取
- 文本粘贴：大文本框手动粘贴 JD
- 提交后自动调用 AI 解析，跳转到详情页

### AI 配置 `/settings/ai-config`

- 配置列表（卡片形式，当前激活项高亮）
- 添加/编辑配置表单：提供商选择、API Key、Base URL、模型名称
- 一键切换激活配置
- 连通性测试按钮

## 核心业务流程

### 添加岗位

```
用户选择输入方式（链接/文本粘贴）
  → [链接] 后端爬取 BOSS 直聘页面 → 提取 JD 文本
  → [文本] 直接使用粘贴内容
  → AI 解析 JD → 结构化输出（岗位信息 + 关键词 + 面试建议）
  → 写入数据库 → 跳转详情页
```

### AI 解析

一次 AI 调用，要求返回结构化 JSON：

- **基本信息提取**：岗位名、公司、薪资、地点、经验、学历
- **关键词提取**：技术栈、核心能力、软技能等标签
- **面试准备建议**：针对该 JD 的具体准备方向、可能的问题、需要重点复习的知识

### 链接爬取

- 使用 Express API Route 作为代理发起请求
- 设置合理的 User-Agent 和 Referer 头
- 若爬取失败，前端提示用户切换为文本粘贴方式
- 爬取成功后提取页面中的 JD 正文内容

### AI 提供商切换

- 所有 AI 调用统一通过 `isActive=true` 的配置
- 切换配置时，仅更新 `isActive` 字段（原激活项置 false，新项置 true）
- 每次调用 AI 前读取当前激活配置，动态构建请求

# JobPilot V2 功能设计

## 背景与目标

基于 V1 版本存在的不足，V2 聚焦于以下改进方向：

1. **AI 设置功能增强** — 支持编辑现有配置 + 真实的连通性验证
2. **JD 爬取能力增强** — 修复 BOSS 直聘爬取问题 + 支持图片/PDF 解析
3. **岗位列表交互优化** — 去除冗余元素，增强意向度展示、添加城市筛选、支持删除
4. **岗位详情信息增强** — 增强的解析数据结构 + 面试题生成

---

## 技术架构

### V2 架构变更

**前端：**
- Vite + React + TypeScript + Tailwind CSS
- 静态资源打包进 macOS 应用

**后端：**
- Tauri v2 + Rust（替代 Express + Prisma）
- 数据库：SQLite（rusqlite 直接操作）
- AI 服务：reqwest 调用 OpenAI/Anthropic 兼容 API

**API 调用：**
- 前端通过 `invoke()` Tauri IPC 调用 Rust 后端命令
- 命令名使用 snake_case（如 `jobs_list`、`job_create`）

---

## 功能详述

### 1. AI 设置 — 编辑功能 + 真实连通测试

**问题：** V1 版本只能创建新配置，无法编辑现有配置，连通性测试仅检测 HTTP 可达性，无法验证实际的 AI 解析能力。

**设计：**
- 每个 AI 配置卡片增加「编辑」按钮，点击后进入编辑模式
- 编辑时表单预填充当前值，支持修改 name、provider、apiKey、baseUrl、model、multimodalModel
- 测试按钮发送实际解析任务，返回真实解析结果（成功显示岗位标题，失败显示具体错误）
- multimodalModel 字段：用于指定图片/PDF 解析使用的多模态模型（可选）

**多模态模型配置：**
- 部分 AI 提供商支持专门的图片解析模型（如 Anthropic 的 claude-sonnet-4-6 等）
- 该字段可选，不填时 fallback 到默认 model

**AI设置页面功能（已实现）：**
- 每个配置卡片增加「编辑」按钮（铅笔图标）和「测试」按钮
- 点击编辑后表单预填充当前值，支持修改 name、apiKey、baseUrl、model、multimodalModel
- 测试按钮调用 `ai_config_test`，显示真实解析结果
- 新增多模态模型字段输入框

**支持的 AI 提供商：**
| Provider | API 类型 | 默认模型 | API Base URL |
|----------|---------|----------|-------------|
| openai | OpenAI 兼容 | gpt-4o | https://api.openai.com/v1 |
| anthropic | Anthropic 格式 | claude-sonnet-4-6 | https://api.anthropic.com/v1 |
| google | OpenAI 兼容 | gemini-2.0-flash | https://generativelanguage.googleapis.com/v1beta/openai |
| deepseek | OpenAI 兼容 | deepseek-chat | https://api.deepseek.com/v1 |
| minimax | Anthropic 格式 | MiniMax-M2.7 | https://api.minimaxi.com/v1 |

---

### 2. JD 爬取 — 多策略 + 图片/PDF 解析

**问题：** BOSS 直聘爬取失败率高，需要人工粘贴 JD。

**设计：**
- 根据 URL 主机名自动识别招聘平台，使用对应的 CSS 选择器
- 支持平台：BOSS直聘(zhipin.com)、智联招聘(zhilian.com)、前程无忧(51job.com)、拉勾网(lagou.com)、猎聘网(liepin.com)
- 匹配失败时回退到通用正文提取

**图片/PDF 解析流程：**
- 新增「图片上传」模式，支持 PNG/JPG/PDF 等格式
- **使用 MinerU 精准解析 API**（替代 AI 多模态模型）
- MinerU 返回 ZIP 包，解压提取 full.md 内容
- 解析后的文本进入正常 JD 解析流程

**MinerU API 配置：**
- 独立设置页面配置 API Token
- 使用标准精准解析 API（`/api/v4/file-urls/batch`）
- Bearer Token 认证
- 支持 vlm 模型（更高精度）
- 文件限制：≤200MB，页数 ≤200

---

### 3. 新增岗位页 — 多步骤流程

**问题：** V1 版本输入后直接解析，用户无法预览/编辑爬取的内容。

**设计 — 四步流程：**

| 步骤 | 状态 | 说明 |
|------|------|------|
| 输入 | `input` | 选择链接/文本/图片模式，填写内容 |
| 预览 | `preview` | 显示爬取的内容，可手动编辑修改 |
| 解析 | `parsing` | 显示解析进度 |
| 完成 | `done` | 跳转详情页 |

**交互细节：**
- 链接模式：输入 URL → 爬取 → 进入预览
- 文本模式：直接进入预览
- 图片模式：上传图片 → MinerU 解析 → 进入预览

---

### 4. 岗位列表 — UI 交互优化

**问题：** 存在重复的「添加岗位」按钮，意向度显示不直观，城市筛选缺失，删除操作不便。

**设计：**
- **去除重复按钮**：移除 JobsList 页面 header 中的「添加岗位」按钮（该按钮已存在于 Dashboard）
- **意向度标签化**：从圆点改为彩色文字标签（高意向=红色背景，中意向=橙色，低意向=灰色）
- **公司规模显示**：在公司名称旁显示 companySize badge
- **城市筛选**：下拉菜单显示所有唯一城市，支持多条件筛选
- **卡片删除**：hover 时显示删除按钮，点击弹出确认对话框

---

### 5. 岗位详情 — 增强解析 + 面试题

**增强的解析数据结构：**

| 字段 | 说明 |
|------|------|
| roleAnalysis | 岗位类型、职级、核心关注点、典型面试轮次 |
| interviewInsights | 高频考察点、潜在问题列表 |
| preparationGuide | 重点准备内容、项目准备建议、简历优化建议 |

**岗位职责/要求增强：**
- 职责增加 category 标注（业务/技术/管理）
- 要求增加 type 标注（必备/加分）
- 移除 importance 小点点，简化显示

**关键词展示：**
- 技术关键词显示 level（基础/熟练/精通）
- 移除 importance 强度指示条，简化显示

**面试题生成：**
- 点击「生成面试题」按钮，基于 JD 原始内容生成 5 道核心面试题
- 每道题包含：问题文本、类型（技术面/行为面/业务面）、难度（简单/中等/困难）
- 可展开查看 guidance（考察点、回答策略、参考答案、应答重点）

**页面布局（V2.1优化）：**
- 最大宽度 `max-w-7xl`，横向拓宽
- 4列网格布局：左侧2列（岗位分析+职位描述+面试题库），右侧2列（关键词+状态管理+AI面试建议）
- 面试题库独占底部横向宽度，不分栏

---

## 数据结构

### SQLite Schema

**Job 表：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | UUID 主键 |
| title | TEXT | 岗位名称 |
| company | TEXT | 公司名称 |
| salary | TEXT? | 薪资范围 |
| location | TEXT? | 工作地点 |
| experience | TEXT? | 经验要求 |
| education | TEXT? | 学历要求 |
| company_size | TEXT? | 公司规模 |
| source_url | TEXT? | 来源 URL |
| source_text | TEXT? | 来源文本 |
| jd_raw_content | TEXT | JD 原始内容 |
| jd_parsed_content | TEXT? | 解析后内容（JSON） |
| keywords | TEXT? | 关键词（JSON） |
| preference_level | TEXT | 意向度 |
| application_status | TEXT | 申请状态 |
| recruitment_status | TEXT | 招聘状态 |
| interview_questions | TEXT? | 面试题（JSON） |
| role_analysis | TEXT? | 岗位分析（JSON） |
| interview_insights | TEXT? | 面试洞察（JSON） |
| preparation_guide | TEXT? | 准备指南（JSON） |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

**ai_provider_config 表：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | UUID 主键 |
| name | TEXT | 配置名称 |
| provider | TEXT | 提供商类型 |
| api_key | TEXT | API 密钥 |
| base_url | TEXT? | 自定义 API 地址 |
| model | TEXT | 模型名称 |
| multimodal_model | TEXT? | 多模态模型 |
| is_active | INTEGER | 是否激活（0/1） |
| created_at | TEXT | 创建时间 |

### JSON 存储说明

以下字段在 SQLite 中存储为 TEXT 类型，内容为 JSON 字符串：

- `jdParsedContent` — 包含 responsibilities、requirements
- `keywords` — 包含 tech、skills、softSkills 数组
- `interviewQuestions` — 面试题数组
- `roleAnalysis` — 岗位分析对象
- `interviewInsights` — 面试洞察对象
- `preparationGuide` — 准备指南对象

读取时需要 `JSON.parse()`，写入时需要 `JSON.stringify()`。

---

## Tauri 命令

### Jobs 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| jobs_list | params? | Job[] | 获取岗位列表 |
| job_get | id | Job | 获取单个岗位 |
| job_create | input | Job | 创建岗位 |
| job_update | id, input | Job | 更新岗位 |
| job_delete | id | void | 删除岗位 |
| job_reparse | id | Job | 重新解析 JD |
| job_generate_interview_questions | id | Job | 生成面试题 |

### AI Config 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| ai_config_list | - | AiProviderConfig[] | 列表 |
| ai_config_get_active | - | AiProviderConfig | 获取激活配置 |
| ai_config_create | input | AiProviderConfig | 创建 |
| ai_config_update | id, input | AiProviderConfig | 更新 |
| ai_config_activate | id | void | 激活 |
| ai_config_delete | id | void | 删除 |
| ai_config_test | - | TestConnectionResult | 测试连接 |

### Scrape/MinerU 命令

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| scrape_url | url | ScrapeResult | 爬取网页 |
| scrape_image | fileBase64, filename | string | AI 图片解析 |
| mineru_parse | fileBase64, filename, apiToken? | string | MinerU 图片解析 |

---

## 页面变更清单

| 页面 | 变更内容 |
|------|---------|
| AISettings | 编辑模式、真实连通测试、multimodalModel 字段 |
| NewJob | 多步骤流程（input → preview → parsing → done）、图片上传模式 |
| JobsList | 删除重复按钮、意向标签化、城市筛选、卡片删除 |
| JobDetail | roleAnalysis 展示、关键词 importance 指示、面试题生成与展示、PreparationGuide 展示 |
| MinerUSettings | MinerU API Token 配置（待实现） |

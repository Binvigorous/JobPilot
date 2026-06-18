# JobPilot 产品需求文档（PRD）

> 本文档整理 JobPilot 当前已实现的全部模块与功能，作为产品现状说明与后续迭代基线。
> 版本：v0.1.0 · 平台：macOS（Apple Silicon）· 更新：2026-06

---

## 1. 产品概述

**JobPilot** 是一款 macOS 原生桌面**求职管理工具**，核心是用 AI 把零散的招聘 JD（链接/文本/截图）解析成结构化信息，并围绕"投递 → 多轮面试 → 复盘"的真实流程，帮助求职者**集中管理岗位、追踪面试进度、诊断求职转化**。

- **目标用户**：正在找工作、同时跟进多个岗位的求职者。
- **核心价值**：
  1. **省录入**：JD 自动解析（含图片/PDF OCR），不用手抄。
  2. **可追踪**：每个岗位的投递状态 + 多轮面试明细（被问的问题、答案、复盘）。
  3. **可诊断**：求职转化漏斗定位卡点（简历/投递问题 vs 面试表现问题）。
  4. **可备战**：AI 生成面试洞察、面试题与作答指导、准备指南。
- **数据归属**：全部本地存储（SQLite），API Key 仅存本地，除调用 AI/OCR 外可离线使用。

---

## 2. 技术架构

| 层 | 技术 |
|---|---|
| 前端 | Vite + React + TypeScript + Tailwind CSS + motion/react，静态资源打包进 app |
| 后端 | Tauri v2 + Rust，`rusqlite` 直接操作 SQLite |
| 数据库 | SQLite，位于 app data 目录 `jobpilot.db`（自动创建 + 列迁移） |
| AI 服务 | Rust 端经 `reqwest` 调用 OpenAI 兼容 / Anthropic 兼容 API |
| OCR | MinerU 精准解析 API（图片/PDF → Markdown） |
| 爬虫 | Rust `scraper`，按招聘平台选择器 + 正文回退 |

**前后端通信**：前端 `invoke('snake_case_command', params)` 调用 Rust 命令。

**主要 IPC 命令**：
- 岗位：`jobs_list` / `job_get` / `job_create` / `job_update` / `job_delete` / `job_reparse` / `job_generate_interview_questions`
- AI 配置：`ai_config_list` / `ai_config_get_active` / `ai_config_create` / `ai_config_update` / `ai_config_activate` / `ai_config_delete` / `ai_config_test`
- 采集：`scrape_url` / `scrape_image` / `mineru_parse` / `mineru_get_settings` / `mineru_save_settings` / `mineru_test`

---

## 3. 信息架构与导航

顶部导航三入口 + 两个衍生页：

- **仪表盘**（`/`）：求职总览与诊断
- **岗位**（`/jobs`）：岗位列表
- **AI 设置**（`/settings/ai-config`）：语言模型 / OCR 模型配置
- **添加岗位**（`/jobs/new`）：录入新岗位（导航右侧常驻按钮）
- **岗位详情**（`/jobs/:id`）：单个岗位的全部信息与操作

---

## 4. 数据模型

### 4.1 岗位 Job

| 字段 | 说明 |
|---|---|
| id / title / company | 标识、岗位名、公司 |
| salary / location / experience / education / companySize / companyAddress | 基础信息（可手动编辑） |
| sourceUrl / sourceText / jdRawContent | 来源链接 / 来源文本 / JD 原文 |
| jdParsedContent (JSON) | 职责 responsibilities[] + 要求 requirements[] |
| keywords (JSON) | 技术栈 tech[] / 核心能力 skills[] / 软技能 softSkills[] |
| roleAnalysis (JSON) | 岗位类型 roleType / 职级 seniority / 核心关注点 focusAreas[] / 典型面试轮次 typicalInterviewRounds[] |
| interviewInsights (JSON) | 高频考点 highFrequencyTopics[] / 潜在问题 potentialQuestions[] |
| preparationGuide (JSON) | 重点准备 priorityPreparation[] / 项目准备 projectPreparation[] / 简历优化 resumeOptimization[] |
| interviewQuestions (JSON) | AI 生成题库：question/type/difficulty/guidance(考察点/回答策略/参考答案/应答重点) |
| interviewRounds (JSON) | 多轮面试明细（见 4.2） |
| jdImages (JSON) | 原始 JD 截图，base64 字符串数组 |
| preferenceLevel | 意向度：high / medium / low / none |
| applicationStatus | 投递状态（见 4.3） |
| interviewDate / interviewFeedback | 旧的单值字段（已被多轮面试取代，保留兼容） |
| aiInterviewGuide | AI 解析失败/未配置时的提示文案（错误通道） |
| notes / createdAt / updatedAt | 备注 / 时间戳 |

### 4.2 面试轮次 InterviewRound

```
{ id, name(一面/二面/HR面…), date?, status, questions: [{question, answer?}], feedback? }
```
轮次状态 RoundStatus：`pending 待进行` / `awaiting_result 待结果` / `passed 已通过` / `failed 未通过`。

### 4.3 投递状态 ApplicationStatus（6 态）

`not_applied 待投递` / `applied 已投递` / `interviewing 面试中` / `offer Offer` / `withdrawn 已撤回` / `eliminated 已淘汰`
（注：原「已拒绝 rejected」已合并入「已淘汰」。）

### 4.4 AI 配置 AiProviderConfig

```
{ id, name, provider(协议类型), apiKey, baseUrl, model, multimodalModel?, isActive }
```
- `provider`：`openai_compatible` 或 `anthropic_compatible`。
- 同时仅一个配置 `isActive`。MinerU 设置独立存于 `mineru_settings.json`（apiKey + modelVersion）。

---

## 5. 功能模块

### 5.1 仪表盘（Dashboard）

求职总览与诊断，自上而下：

1. **概览 + 整体指标**（一张横向卡片）：左侧标题 + 跟踪岗位总数；右侧 4 指标——
   - 进行中机会（已投递+面试中，占比）
   - 待投递（not_applied 数）
   - 近期面试（未来面试场次 + 最近日期）
   - Offer 率（Offer / 已投递）
2. **求职转化漏斗**（核心诊断）：
   - 主干（单调递减）：已收录 → 已投递 → 第 1 轮 → 第 2 轮 …（按面试轮深动态展开）。
   - 级间转化率 + 口语诊断：投递→一面偏低提示「简历/投递没打动」，各轮通过偏低提示「现场要复盘」（仅在真偏低且样本≥3 时出现）。
   - 终态按"进入一面"对账：**Offer + 未通过 + 进行中 = 进入一面数**；投递后未面就出局的归入"投递→一面"落差。
3. **投递岗位类型分布**：已投递岗位按 `roleAnalysis.roleType` 降序条形（前 6）。
4. **分城市投递**：已投递岗位按城市（市级，从 location 提取）降序条形。
5. **近期面试**：未来面试 Top 3，点击进详情。
6. **最近添加**：最新收录的 5 个岗位。

### 5.2 岗位列表（JobsList）

- **搜索**：按公司/岗位名。
- **筛选**：投递状态、意向度、城市。
- **视图切换**：卡片视图（网格）/ 列表视图（紧凑行，含经验·学历·公司规模），localStorage 记忆。
- **分区**：进行中与「已淘汰」分区，已淘汰折叠到底部灰色区。
- **删除**：内联二次确认。

### 5.3 添加岗位（NewJob）

三种录入方式 → 预览确认 → AI 解析 → 跳详情：

- **链接**：爬取招聘页（BOSS直聘/智联/前程无忧/拉勾/猎聘 + 正文回退）。
- **文本**：直接粘贴 JD。
- **图片/PDF**：MinerU OCR 提取文字；**原图自动留存**到该岗位的「JD 原图」。
- 录入后台异步调用 AI 解析（需已激活 AI 配置）。

### 5.4 岗位详情（JobDetail）

顶部 Hero（公司头像/岗位名/公司/薪资/地点/经验/学历/状态/原链接/面试倒计时）+ **页面级页签**。
**全部 AI 提取的文字内容均可点击就地编辑、失焦自动保存**（枚举标签只读；列表型支持增删条目）。

- **页签 1 · 岗位信息**：岗位分析 与 状态管理（投递状态/意向度/备注）左右并列；职位描述（职责/要求）；关键词（技术栈/核心能力/软技能）。
- **页签 2 · 面试指南**：内含子页签——
  - 面试洞察：高频考点 + 潜在问题；可「生成作答指导」得到含参考答案的详细题库（可展开/编辑/删除）。
  - 准备指南：重点准备（主题/为什么/怎么做）+ 项目准备 + 简历优化。
- **页签 3 · 进度管理**：
  - 面试进度（多轮追踪）：轮次以页签切换，每轮含 状态(四态)/日期/被问问题+答案/复盘反馈，可增删轮与问题。
  - AI 面试建议（解析失败时的提示）。
- **页签 4 · JD 原图**：上传/粘贴(⌘V)/查看放大(lightbox)/删除原始截图。

### 5.5 AI 设置（AISettings）

两个页签：

- **语言模型**：基于协议接入任意厂商——选协议（OpenAI 兼容 / Anthropic 兼容）+ 模型 + 端点 + Key；支持新增/编辑/测试连接/激活/删除；内置常用厂商快速填充。
- **OCR 模型**：MinerU 的 API Key、模型版本（vlm/pipeline）、测试连接、保存。

---

## 6. AI 能力

- **JD 解析**（`parse_jd`）：从 JD 文本提取 6 类结构化数据（字段/职责要求/关键词/岗位分析/面试洞察/准备指南），写入对应 JSON 列。
- **面试题生成**（`generate_interview_questions`）：基于 JD 生成带作答指导的题库。
- **图片/PDF 解析**：MinerU OCR → 文本，再走 JD 解析。
- **协议兼容**：OpenAI 兼容走 `/chat/completions`（Bearer）；Anthropic 兼容走 `/messages`（x-api-key + Bearer 双发以兼容第三方如火山引擎）；对推理模型（content 为空时回退 reasoning_content）做了兼容。

---

## 7. 关键业务规则（状态联动）

- **轮次驱动粗状态**（前向驱动，不覆盖用户显式设的 Offer/已撤回）：
  - 添加第一轮 → 自动置「面试中」；
  - 任一轮标「未通过」→ 自动置「已淘汰」。
- **漏斗终态纳入轮次成败**：有「未通过」轮次的岗位即使粗状态未更新，也计入漏斗「未通过」。
- **投递状态与轮次**：粗状态供列表筛选/漏斗里程碑；轮次记录明细，两者通过上述规则联动。

---

## 8. 非功能性说明

- **平台**：macOS（Apple Silicon），Tauri v2 原生 webview。
- **隐私/存储**：岗位数据、AI Key、JD 原图均存本地 `jobpilot.db` / 本地配置文件，不上传服务器（AI/OCR 调用除外，走 HTTPS）。
- **离线**：除 AI 解析/题目生成/OCR/链接爬取外，浏览与编辑均可离线。
- **数据库迁移**：启动时幂等 `ALTER TABLE ADD COLUMN` 平滑加列；含 rejected→eliminated 归一迁移。

---

## 9. 已知约束 / 后续可迭代

- `aiInterviewGuide` 目前主要承载错误提示，并非真正的 AI 建议正文（建议内容已由准备指南承载）。
- 岗位类型/城市分布依赖 AI 解析质量与 location 文本格式，可能出现"未分类/未知"。
- 漏斗诊断阈值（约面率<40%、通过率<50%、样本≥3）为经验值，可随数据量调整。
- 打包 DMG 依赖手动 `hdiutil` 流程（Tauri 自带 `bundle_dmg.sh` 在本机失败）。

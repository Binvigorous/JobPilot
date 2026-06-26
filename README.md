# JobPilot · 求职指挥舱

> 用 AI 把求职从"凭感觉的体力活"，变成"有数据、可复盘、可优化的项目管理"。
> A local-first, AI-powered job-hunting cockpit for macOS.

JobPilot 是一款 **macOS 原生桌面应用**：把零散的招聘 JD（链接 / 文本 / 截图）一键解析成结构化信息，围绕"投递 → 多轮面试 → 复盘"的真实流程，帮你**集中管理岗位、追踪面试进度、用数据诊断求职转化**。

<!-- 建议在此处放 2~4 张截图：仪表盘（转化漏斗）、岗位详情（多轮面试）、AI 解析、AI 配置 -->
<!-- 例如： ![仪表盘](docs/screenshots/dashboard.png) -->

---

## ✨ 核心功能

- **AI 一键解析 JD**：支持链接爬取、纯文本、**图片/PDF（OCR）** 三种录入；大模型把非结构化 JD 转成结构化数据——岗位画像、职责要求、关键词、面试高频考点。
- **求职转化漏斗（核心诊断）**：已收录 → 已投递 → 一面 → 二面 …，逐级转化率即诊断：投递→一面 低多为简历/投递问题，一面之后通过低多为面试表现问题。
- **多轮面试追踪**：每个岗位按轮记录——状态、被问的问题、我的回答、复盘反馈；轮次结果自动联动投递状态与漏斗。
- **AI 面试教练**：基于 JD 生成面试洞察、带参考答案的面试题库、以及"重点准备 / 项目准备 / 简历优化"指南。
- **全字段可编辑（人机协同）**：AI 会出错，所以详情页里 AI 提取的内容都能点击就地修改——AI 负责 0→80% 的结构化，人负责最后 20% 的校正。
- **协议无关的 AI 接入**：兼容 OpenAI / Anthropic 两套协议，可接任意厂商模型，不被某一家绑死。
- **本地优先**：岗位数据、API Key、JD 原图全部存本地 SQLite / 本地配置，不上传服务器。

---

## 🧠 设计亮点（产品 & AI 思维）

- **把模糊焦虑翻译成可定位的环节**：转化漏斗不只是记录，而是让数据帮用户判断"问题在简历还是在面试表现"。
- **AI 当转换引擎，不是聊天框**：用 AI 把非结构化 JD → 可被产品消费、能驱动后续功能的结构化数据。
- **对 AI 局限的工程化处理**：内容可编辑修正、推理模型（content 为空回退 reasoning_content）兼容、解析失败兜底提示。
- **状态联动闭环**：粗状态（投递状态）供筛选/里程碑，轮次记录明细，二者通过规则联动（加首轮→面试中、某轮未通过→已淘汰）。

> 完整产品说明见 [docs/PRD.md](docs/PRD.md)。

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vite + React + TypeScript + Tailwind CSS + motion/react |
| 后端 | Tauri v2 + Rust（`rusqlite` 直连 SQLite） |
| 数据 | 本地 SQLite（自动建表 + 列迁移） |
| AI | Rust 端 `reqwest` 调用 OpenAI / Anthropic 兼容 API |
| OCR | MinerU 精准解析（图片/PDF → Markdown） |

前后端通过 Tauri `invoke` 通信；爬虫按招聘平台选择器解析，失败回退正文提取。

---

## 🚀 本地运行

> 需要 Node.js、Rust 工具链、以及 macOS（Apple Silicon）。

```bash
npm install
npm run dev        # 启动桌面应用（Tauri dev）
npm run build      # 构建 macOS 生产版本
```

首次使用：进入「AI 设置」配置一个语言模型（OpenAI / Anthropic 兼容皆可），即可开始添加岗位并自动解析。

---

## 📁 项目结构

```
src/                  # React 前端
  app/api/            # Tauri invoke 封装（jobs / ai-config）
  app/pages/          # 仪表盘 / 岗位列表 / 岗位详情 / 添加岗位 / AI 设置
  app/components/      # 复用组件
src-tauri/            # Tauri v2 + Rust 后端
  src/ai.rs           # AI 调用（JD 解析 / 面试题生成 / 图片解析）
  src/scraper.rs      # 招聘平台爬虫
  src/commands/       # IPC 命令（jobs / ai_config / scrape / mineru）
docs/PRD.md           # 产品需求文档
changelog/            # 开发日志
```

---

## 📌 说明

- 仅个人学习/求职展示用途；解析的招聘内容版权归原招聘方所有。
- API Key 仅保存在本地，请勿提交到仓库。

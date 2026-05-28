# JobPilot V2 实施计划

## Context

当前系统状态：
- Vite+React 前端 (5173) + Express+Prisma+SQLite 后端 (3001)
- AI 解析用 `callAI()` 支持 OpenAI 兼容格式和 Anthropic
- Job/AIProviderConfig 的 parsedContent/keywords 存为 TEXT(JSON 字符串)，非原生 JSON 列
- 前端用 `jobsApi` / `aiConfigsApi` 通过 Vite proxy 调用后端

V2 目标：
1. 增强 AI 设置（编辑功能 + 真实验证连通性）
2. 修复 BOSS 爬取 + 支持图片/PDF 解析
3. 优化岗位列表 UI（去掉重复按钮、增强意向显示、加城市筛选、加删除）
4. 优化岗位详情（增强 Prompt 结构 + 生成面试题）

---

## Phase 1: Prisma Schema 迁移（基础层）

**改动文件：** `server/prisma/schema.prisma`

给 `Job` 添加：
- `companySize String?` — 公司规模（如 "100-499人"）
- `interviewQuestions String?` — 面试题 JSON

给 `AIProviderConfig` 添加：
- `multimodalModel String?` — 多模态模型名称（用于图片/PDF 解析）

运行 `prisma migrate dev` 生成迁移。

**验证：** 重启服务后创建/查询岗位不报错。

---

## Phase 2: AI 设置 — 编辑功能 + 真实连通测试

### 后端 `server/src/services/ai.ts`

**增强 `testAIConnection()`：**
- 发送一个最小化解析任务（而不是只测 HTTP 可达）
- 验证能成功解析并返回有效 JSON
- 返回具体的测试结果（成功/失败原因）

**新增 `parseImageJD(imageBase64, filename)`：**
- 将图片内容转为 AI 支持的 content block 格式
- 支持 Anthropic 的 image block、OpenAI 的 url/data 格式

**新增 `generateInterviewQuestions(jdContent)`：**
- 基于 JD 内容生成 5 个核心面试题
- 每个题包含：问题文本、类型、难度、guidance（考察点、回答策略、参考答案、应答重点）

### 后端 `server/src/routes/ai-config.ts`

- `PUT /:id` 已支持部分更新，确认 `multimodalModel` 字段会被正确保存

### 前端 `src/app/pages/AISettings.tsx`

- 增加 `editingId` state，追踪正在编辑的配置
- 每个配置卡片加 Edit 按钮（铅笔图标）
- 编辑时表单预填充现有值，提交用 `aiConfigsApi.update(id, ...)`
- 取消按钮重置编辑状态
- 测试按钮改为显示真实解析结果（成功显示"连通且解析正常"，失败显示具体错误）
- 增加 `multimodalModel` 字段选择/输入框

### 前端 `src/app/api/ai-config.ts`

- 更新 `UpdateConfigInput` 类型包含 `multimodalModel`

**验证：** 能编辑现有配置并保存，测试连通性显示真实结果。

---

## Phase 3: 爬取路由 — 多策略 + URL 模式检测

**改动文件：** `server/src/routes/scrape.ts`

重构为策略注册模式：

```typescript
const SCRAPER_STRATEGIES = {
  'zhipin.com': {
    selectors: { title: '.job-title h3', company: '.company-name', description: '.job-detail-section' },
    fallback: 'body'
  },
  'zhipin.com': { /* 智联招聘选择器 */ },
  '51job.com': { /* 前程无忧选择器 */ },
  'default': { selectors: {}, fallback: 'body' }
};
```

逻辑：
1. 从 URL 提取 hostname，匹配策略
2. 依次尝试主选择器 → 回退选择器 → 通用文本提取
3. 返回 `{ content, source: 'zhipin' | 'zhilian' | ... }`
4. 内容 < 50 字符时返回 422

**新增端点：** `POST /api/scrape/image`
- 接收 `{ file: base64string, filename: string }`
- 调用 `parseImageJD()`，使用配置的 `multimodalModel`

**验证：** 用 BOSS 直聘链接、智联链接、前程无忧链接测试，爬取成功率大幅提升。

---

## Phase 4: 新增岗位页 — 多步骤流程 + 图片/PDF 支持

**改动文件：** `src/app/pages/NewJob.tsx`

新增流程状态： `'input' | 'preview' | 'confirm' | 'parsing' | 'done'`

1. **Input**：选择链接 / 文本 / 图片上传
2. **Preview**（新增）：显示爬取内容，可编辑原文后再确认
3. **Confirm**（新增）：显示准备解析 + 选中的 AI 配置
4. **Parsing / Done**：同现有逻辑

**图片/PDF 上传：**
- 文件 input 接受 `image/*` 和 `.pdf`
- 转为 base64 发送到 `POST /api/scrape/image`
- 返回提取的文本后继续正常解析流程

**验证：** 完整流程（URL → 预览 → 确认 → 解析 → 跳转详情）正常运行，图片/PDF 解析成功。

---

## Phase 5: 岗位列表 UI 优化

**改动文件：** `src/app/pages/JobsList.tsx`

1. **删除"添加岗位"按钮**：去掉此页面 header 中的 `<Link to="/jobs/new">` 按钮（保留在 Dashboard）

2. **意向级别更显眼**：
   - 从小圆点改为彩色标签（如 high → 红色背景 `bg-red-50 text-red-600`）
   - 显示文字标签而非只有圆点

3. **显示公司规模**：
   - 在公司名称旁显示 `companySize` badge（如 "100-499人"）

4. **增加城市筛选**：
   - 从岗位列表提取所有唯一城市
   - 添加城市筛选器（dropdown 或 button 组）
   - 筛选逻辑：`matchesCity = cityFilter === 'all' || job.location?.includes(cityFilter)`

5. **卡片上增加删除按钮**：
   - 卡片右下角，hover 时显示
   - 点击显示确认对话框（"确定删除此岗位吗？"）
   - 确认后调用 `jobsApi.delete(job.id)` 并从本地 state 移除

**验证：** 页面能正常筛选，删除功能正常。

---

## Phase 6: 岗位详情 — 增强解析 + 面试题生成

### 后端 `server/src/services/ai.ts`

**更新 `PARSE_JD_PROMPT`** 为新结构：

```typescript
const PARSE_JD_PROMPT = `你是一位资深招聘专家+面试官，请深度分析以下JD，返回结构化JSON：
{
  "extractedFields": { "title", "company", "salary", "location", "experience", "education", "companySize" },
  "parsedContent": {
    "responsibilities": [{ "text": "职责描述", "category": "业务|技术|管理", "importance": "high|medium|low" }],
    "requirements": [{ "text": "要求描述", "type": "must|plus", "importance": 1-5 }]
  },
  "keywords": {
    "tech": [{ "name": "技术关键词", "level": "基础|熟练|精通", "importance": 1-5 }],
    "skills": [{ "name": "核心能力", "importance": 1-5 }],
    "softSkills": [{ "name": "软技能", "importance": 1-5 }]
  },
  "roleAnalysis": { "roleType": "岗位类型", "seniority": "初级|中级|高级", "focusAreas": [], "typicalInterviewRounds": [] },
  "interviewInsights": {
    "highFrequencyTopics": [],
    "potentialQuestions": [{ "question": "", "type": "技术|行为|业务", "difficulty": "简单|中等|困难" }]
  },
  "preparationGuide": { "priorityPreparation": [], "projectPreparation": [], "resumeOptimization": [] }
}
{{JD}}
请返回JSON，不要其他文字。`;
```

**新增 `generateInterviewQuestions(jdContent)` 函数：**
- 专注生成 5 个高频核心面试题
- 每题结构：`{ question, type, difficulty, guidance: { 考察点, 回答策略, 参考答案, 应答重点 } }`

### 后端 `server/src/routes/jobs.ts`

**新增端点：** `POST /api/jobs/:id/interview-questions`
- 调用 `generateInterviewQuestions(job.jdRawContent)`
- 更新 `job.interviewQuestions` 字段
- 返回更新后的 job

### 前端 `src/app/pages/JobDetail.tsx`

- 更新 `responsibilities` 显示（category badge + importance 颜色）
- 更新 `keywords` 显示（level/importance 强度指示）
- 增加"生成面试题"按钮（调用 `jobsApi.generateInterviewQuestions(id)`）
- 新增可展开的面试题区域（每题显示：问题文本、type badge、difficulty badge、可展开的 guidance）
- 显示 `roleAnalysis` 和 `preparationGuide` 内容

### 前端 `src/app/api/jobs.ts`

- 更新 `Job` 接口中 `parsedContent` 和 `keywords` 的类型
- 新增 `generateInterviewQuestions(id: string): Promise<Job>` 方法
- 新增 `interviewQuestions` 相关类型

**验证：** 提交 JD 后 detail 页正确显示增强解析数据，点击生成面试题能展示 5 道题及指导。

---

## Phase 7: 集成 + 收尾

- 端到端测试：URL 爬取 → 预览 → 确认 → 解析 → 详情 → 生成面试题
- 验证所有筛选功能正常（状态/意向/城市）
- 增加新功能的加载状态和错误处理
- 检查移动端响应式

---

## 关键文件清单

| 文件 | 改动内容 |
|------|---------|
| `server/prisma/schema.prisma` | 新增 companySize, interviewQuestions, multimodalModel 字段 |
| `server/src/services/ai.ts` | 增强 parseJD prompt, 新增 parseImageJD, generateInterviewQuestions, 增强 testAIConnection |
| `server/src/routes/scrape.ts` | 多策略爬取, 新增 POST /api/scrape/image |
| `server/src/routes/jobs.ts` | 新增 POST /:id/interview-questions |
| `server/src/routes/ai-config.ts` | 确认 PUT /:id 支持 multimodalModel |
| `src/app/pages/AISettings.tsx` | 编辑模式, 真实连通测试, multimodalModel 字段 |
| `src/app/pages/NewJob.tsx` | 多步骤流程, 图片/PDF 上传 |
| `src/app/pages/JobsList.tsx` | 删除重复按钮, 增强意向显示, 城市筛选, 卡片删除 |
| `src/app/pages/JobDetail.tsx` | 增强解析显示, 面试题生成与展示 |
| `src/app/api/jobs.ts` | 更新类型, 新增 generateInterviewQuestions 方法 |
| `src/app/api/ai-config.ts` | 更新 UpdateConfigInput 类型 |

---

## 执行顺序

| Phase | 依赖 | 说明 |
|-------|------|------|
| Phase 1 | 无 | 基础层，改 schema |
| Phase 2 | Phase 1 | AI 设置需要 multimodalModel 字段 |
| Phase 3 | 无 | 爬虫独立，不影响现有逻辑 |
| Phase 4 | Phase 2, 3 | 需要图片解析 + 改进爬虫 |
| Phase 5 | 无 | 纯 UI 改动 |
| Phase 6 | Phase 1 | 需要 interviewQuestions 字段 |
| Phase 7 | 全部 | 集成测试 |

---

## V2.1 迭代优化记录（2026-05-03）

### 问题修复

| 问题 | 涉及文件 | 修复方案 |
|------|---------|---------|
| JobDetail.tsx TypeScript错误：importanceColors数字索引、importience拼写错误 | `src/app/pages/JobDetail.tsx` | 添加 `Record<number, ...>` 类型，修复拼写 |
| NewJob.tsx FileReader API错误：onloaderror不存在 | `src/app/pages/NewJob.tsx` | 改用 `reader.onerror` |
| JobsList.tsx 关键词渲染错误：tag.name访问string类型 | `src/app/pages/JobsList.tsx` | 支持string和object两种格式 |
| jobs.ts API参数映射：status未映射到applicationStatus | `server/src/routes/jobs.ts` | 提取status参数并映射 |

### 功能优化

| 优化项 | 涉及文件 | 说明 |
|--------|---------|------|
| AI设置页面：增加编辑功能和测试按钮 | `src/app/pages/AISettings.tsx` | 铅笔图标编辑、多模态模型配置 |
| 岗位详情页：去除importance点点指示，优化布局 | `src/app/pages/JobDetail.tsx` | 改为4列左右布局，移除小点点 |
| 新增岗位页：修复图片功能返回值处理 | `src/app/pages/NewJob.tsx` | `scrapeImage`返回直接为string |

### 布局调整

**岗位详情页新布局（4列网格）：**
- 左侧2列：岗位分析、职位描述、面试题库（面试题库占满宽度）
- 右侧2列：关键词、状态管理、AI面试建议

**最大宽度：** `max-w-7xl mx-auto`

### 待优化项

| 优化项 | 优先级 | 说明 |
|--------|-------|------|
| 图片解析功能 | P1 | 需要配置支持多模态的AI模型（如MiniMax需确认是否支持） |
| 岗位列表页拓宽 | P2 | 横向布局可进一步拓宽 |

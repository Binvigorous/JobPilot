# JobPilot v0.1.0 - 快速开始指南

## 📦 构建成功！

应用已成功构建，可以直接运行。

---

## 🚀 启动应用

### 方式 1：直接运行（推荐）

```bash
# 从项目目录运行
open /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app
```

或者直接在 Finder 中双击 `JobPilot.app` 文件。

### 方式 2：复制到 Applications 文件夹

```bash
# 复制到系统 Applications 目录
cp -r /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app /Applications/

# 然后从 Applications 文件夹打开
```

---

## 🔧 添加 AI 配置

应用启动后：

1. **点击右上角 ⚙️ Settings 按钮**
2. **切换到 AI Config 标签页**
3. **点击 + Add New Config 按钮**

### 推荐测试配置

#### 🎯 最简单的方案（使用 DeepSeek）

```
配置名称: DeepSeek Test
协议: OpenAI Compatible
API 地址: https://api.deepseek.com/v1
模型: deepseek-chat
API Key: (从 https://platform.deepseek.com 获取)
```

**为什么选择 DeepSeek？**
- ✅ 新用户有 500 万 token 免费额度
- ✅ API 便宜（比 OpenAI 便宜 90%）
- ✅ 中文支持优秀
- ✅ 响应快速
- ✅ 无需科学上网

#### 其他选项

| 厂商 | Base URL | 模型 | 特点 |
|-----|---------|------|------|
| 月之暗面(Kimi) | https://api.moonshot.cn/v1 | moonshot-v1-8k | 免费额度，快速 |
| 智谱 AI | https://open.bigmodel.cn/api/paas/v4 | glm-4 | 多模态支持 |
| OpenAI | https://api.openai.com/v1 | gpt-4-turbo | 需要付费 |
| Anthropic | https://api.anthropic.com/v1 | claude-3-opus-20240229 | 需要付费 |

---

## ✅ 测试连接

添加配置后：

1. **点击 🔌 Test Connection 按钮**
2. 看到绿色 ✅ 提示表示成功
3. 如果失败，检查：
   - API Key 是否完整
   - Base URL 是否正确
   - 网络是否连通

---

## 📄 使用应用

### 新增职位（自动 AI 解析）

1. 点击 **+ New Job** 按钮
2. 粘贴职位描述到 JD 文本框
3. **勾选 Auto-parse with AI**
4. 点击 **Create Job**

应用会自动调用 AI：
- 📊 提取职位字段（标题、公司、薪资、地点等）
- 🔑 提取技术关键词
- 🎯 分析职位类型和级别
- 📋 生成面试准备指南

### 生成面试题

在职位详情页：
1. 点击 **🎓 Generate Interview Questions**
2. AI 生成 5 个可能的面试题
3. 包含难度、回答指导等信息

### 图片 JD 解析

在职位详情页：
1. 点击 **📸 Upload Image** 按钮
2. 选择包含 JD 的截图或 PDF
3. AI 自动识别文字并转换

---

## 📍 应用文件位置

```
项目根目录:
/Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot

可执行应用:
/Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app

DMG 文件（中间产物）:
/Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/rw.4760.JobPilot_0.1.0_aarch64.dmg

数据库位置:
~/Library/Application Support/com.jobpilot.app/jobpilot.db
```

---

## 🐛 故障排查

### 应用打不开

```bash
# 检查应用是否可执行
ls -la /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app/Contents/MacOS/jobpilot

# 如果没有执行权限，添加权限
chmod +x /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app/Contents/MacOS/jobpilot
```

### 应用卡死

- 强制退出：**Command + Q**
- 从 Activity Monitor 中关闭
- 重新启动应用

### 连接失败

检查清单：
- [ ] API Key 是否正确
- [ ] Base URL 是否不包含 `/chat/completions` 等后缀
- [ ] 模型名称是否存在
- [ ] 网络连接是否正常
- [ ] API 额度是否还有

---

## 📚 详细文档

更多详细的测试指南和每个厂商的配置说明，请查看：

📄 **API_TEST_GUIDE.md** - 完整的 API 测试指南

该文档包含：
- 各厂商 API 获取步骤
- 详细的配置示例
- 常见错误解决方案
- 性能对比和建议

---

## 🎯 推荐测试流程

1. **申请 API Key**
   - 访问 https://platform.deepseek.com
   - 注册账户，获取 API Key

2. **启动应用**
   ```bash
   open /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot.app
   ```

3. **添加 AI 配置**
   - Settings > AI Config > + Add New Config
   - 填写 DeepSeek 信息
   - 点击 Test Connection

4. **创建测试职位**
   - 点击 + New Job
   - 粘贴一个真实的职位描述
   - 勾选 Auto-parse with AI
   - 观察 AI 解析结果

5. **生成面试题**
   - 进入职位详情
   - 点击 Generate Interview Questions
   - 检查生成的面试题质量

6. **测试图片 OCR**（如果配置了多模态模型）
   - 上传职位截图或 PDF
   - 检查文字识别准确度

---

## 💬 反馈和问题

遇到问题时，请收集：
1. 错误信息（完整的）
2. 配置信息（不含 API Key）
3. 操作步骤
4. 应用日志（`~/Library/Application Support/com.jobpilot.app/` 中的日志）

---

## 📝 版本信息

- **应用名称**: JobPilot
- **版本**: 0.1.0
- **构建时间**: 2026-05-28
- **架构**: Apple Silicon (aarch64)
- **框架**: Tauri v2 + React + TypeScript

---

祝你使用愉快！🎉

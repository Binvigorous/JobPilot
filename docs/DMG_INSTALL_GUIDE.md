# 📦 JobPilot v0.1.0 DMG 安装指南

## 🎉 DMG 文件已生成！

**文件位置：**
```
/Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot/src-tauri/target/release/bundle/macos/JobPilot_0.1.0_aarch64.dmg
```

**文件大小：** 7.6 MB（压缩率 66.7%）

**验证状态：** ✅ 校验和有效，文件完整

---

## 🚀 安装步骤（3 种方式）

### 方式 1：最简单（推荐）

1. **打开 DMG 文件**
   - 双击 `JobPilot_0.1.0_aarch64.dmg`
   - 或在 Finder 中打开

2. **拖动安装**
   - 将 `JobPilot.app` 拖到右侧的 `Applications` 文件夹
   - 等待复制完成

3. **启动应用**
   - 打开 Applications 文件夹
   - 双击 `JobPilot.app`
   - ✅ 应用启动！

### 方式 2：命令行安装

```bash
# 1. 挂载 DMG
hdiutil attach ~/Desktop/JobPilot_0.1.0_aarch64.dmg

# 2. 复制应用（会自动弹出的 DMG 中）
cp -r /Volumes/JobPilot/JobPilot.app /Applications/

# 3. 卸载 DMG
hdiutil detach /Volumes/JobPilot

# 4. 启动应用
open /Applications/JobPilot.app
```

### 方式 3：直接运行（无需安装）

```bash
# 挂载 DMG
hdiutil attach ~/Desktop/JobPilot_0.1.0_aarch64.dmg

# 直接运行（无需复制到 Applications）
open /Volumes/JobPilot/JobPilot.app

# 完成后卸载
hdiutil detach /Volumes/JobPilot
```

---

## ✅ DMG 文件验证

DMG 文件已通过以下验证：

| 检查项 | 状态 |
|--------|------|
| **文件完整性** | ✅ CRC32 校验和有效 |
| **应用可执行** | ✅ jobpilot 二进制文件完好 |
| **可挂载** | ✅ 成功挂载和卸载 |
| **内容完整** | ✅ 包含 JobPilot.app 和 Applications 快捷方式 |
| **文件大小** | ✅ 7.6 MB（已压缩） |

---

## 🔧 首次启动

### 1️⃣ 启动应用

应用启动后，你应该会看到：
- 左侧：职位列表（初始为空）
- 右侧：职位详情面板
- 右上：⚙️ Settings 按钮

### 2️⃣ 获取 API Key（必需）

应用需要 AI API Key 才能使用 AI 功能。推荐选择：

**🎯 DeepSeek（最便宜，最推荐）**
- 访问：https://platform.deepseek.com
- 新用户有 500 万 token 免费额度
- 无需科学上网
- API 便宜：约 $0.14 / 百万 token

**其他选择：**
- 月之暗面 Kimi：https://platform.moonshot.cn
- 智谱 AI：https://www.bigmodel.cn
- OpenAI：https://platform.openai.com（需要付费）
- Anthropic Claude：https://console.anthropic.com（需要付费）

### 3️⃣ 配置 AI

1. 点击右上角 **⚙️ Settings**
2. 切换到 **AI Config** 标签页
3. 点击 **+ Add New Config**
4. 填写以下信息：

#### DeepSeek 配置示例
```
配置名称: DeepSeek
协议: OpenAI Compatible
API 地址: https://api.deepseek.com/v1
模型名称: deepseek-chat
API Key: (从 platform.deepseek.com 复制)
```

#### 其他协议配置
```
协议 OpenAI Compatible：
  - Base URL 应以 /v1 结尾，不包含 /chat/completions
  - 认证方式：Bearer Token

协议 Anthropic Compatible：
  - Base URL 应以 /v1 结尾，不包含 /messages
  - 认证方式：x-api-key header
```

5. 点击 **🔌 Test Connection** 验证连接
6. 看到 ✅ 绿色成功提示后，点击 **Activate** 激活

### 4️⃣ 测试功能

**创建职位并自动解析：**
1. 点击 **+ New Job** 按钮
2. 在 **Job Description** 字段粘贴职位描述
3. ✅ 勾选 **Auto-parse with AI**
4. 点击 **Create Job**
5. 等待 AI 返回解析结果

**生成面试题：**
1. 进入已创建的职位详情
2. 点击 **🎓 Generate Interview Questions** 按钮
3. 查看 AI 生成的 5 个面试题

**上传图片 JD（需要多模态模型）：**
1. 进入职位详情
2. 点击 **📸 Upload Image** 按钮
3. 选择包含职位描述的截图或 PDF
4. AI 自动识别文字

---

## 📊 系统要求

| 要求 | 规格 |
|------|------|
| **操作系统** | macOS 10.13+ |
| **架构** | Apple Silicon (M1/M2/M3/M4) |
| **内存** | 4 GB RAM（推荐 8 GB+） |
| **存储空间** | 100 MB（包括数据库） |
| **网络** | 需要网络连接调用 AI API |

---

## 🛠️ 常见问题

### Q1：应用无法打开？

**解决方案：**
```bash
# 检查应用权限
chmod +x /Applications/JobPilot.app/Contents/MacOS/jobpilot

# 如果 macOS 提示"不信任的开发者"
# 打开 System Preferences → Security & Privacy
# 允许打开 JobPilot

# 或使用命令行打开（绕过安全提示）
open /Applications/JobPilot.app
```

### Q2：连接失败？

检查清单：
- [ ] API Key 是否完整（没有多余空格）
- [ ] Base URL 是否正确（包含 /v1 但不包含 /chat/completions）
- [ ] 模型名称是否存在（查阅 API 文档）
- [ ] 网络连接是否正常
- [ ] API 账户是否有余额或免费额度

### Q3：如何卸载？

```bash
# 方式 1：从 Applications 文件夹拖到垃圾箱
# 方式 2：命令行卸载
rm -rf /Applications/JobPilot.app

# 删除应用数据（可选）
rm -rf ~/Library/Application\ Support/com.jobpilot.app
```

### Q4：数据存储在哪里？

应用数据存储在：
```
~/Library/Application Support/com.jobpilot.app/jobpilot.db
```

这是一个 SQLite 数据库，包含：
- 所有职位信息
- AI 配置
- 解析结果
- 面试记录

### Q5：如何备份数据？

```bash
# 备份数据库
cp ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db ~/Desktop/jobpilot_backup.db

# 恢复数据库
cp ~/Desktop/jobpilot_backup.db ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db
```

---

## 📱 版本信息

```
应用名称: JobPilot
版本: 0.1.0
构建日期: 2026-05-28
架构: Apple Silicon (aarch64)
框架: Tauri v2
编译方式: Release (优化)
```

---

## 🚨 安全提示

- ✅ 所有数据存储在本地，不上传云端
- ✅ API Key 只存储在本地数据库
- ✅ 所有通信均使用 HTTPS
- ✅ 完全离线可用（除 AI 调用外）

**请勿：**
- ❌ 分享 API Key
- ❌ 共享数据库文件
- ❌ 修改数据库文件

---

## 📚 相关文档

- **QUICK_START.md** - 快速开始指南
- **API_TEST_GUIDE.md** - 详细的 API 配置说明
- **BUILD_SUMMARY.md** - 构建信息

---

## 💬 反馈和支持

遇到问题时，请提供：
1. 完整的错误信息
2. 你的 macOS 版本（`sw_vers`）
3. 应用版本
4. 重现问题的步骤
5. 应用日志（`~/Library/Application Support/com.jobpilot.app/`）

---

## 🎯 下一步

1. **立即使用**：按上面步骤安装并启动
2. **配置 API**：获取 API Key 并添加配置
3. **测试功能**：创建职位并测试 AI 解析
4. **收集反馈**：测试不同的职位描述和 AI 功能

---

祝你使用愉快！🚀

有问题或建议，欢迎随时反馈。

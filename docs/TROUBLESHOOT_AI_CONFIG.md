# AI 配置保存问题诊断指南

## 问题症状
保存 AI 配置时没有任何错误提示，但配置没有被保存

## 可能的原因和解决方案

### 1️⃣ **参数字段名称不匹配**

**问题描述：**
前端使用驼峰命名（如 `apiKey`），而后端期望下划线命名（如 `api_key`）

**检查步骤：**
- 打开浏览器控制台（Command + Option + I）
- 进入 Network 标签页
- 尝试保存配置
- 查看 Tauri 命令的请求参数

**解决方案：**
根据以下映射检查字段名称：

```
前端字段名         →    后端期望名称
apiKey             →    api_key
baseUrl            →    base_url
multimodalModel    →    multimodal_model
isActive           →    is_active
```

### 2️⃣ **数据库被锁定**

**问题描述：**
数据库被其他进程锁定，导致写入失败

**检查步骤：**
```bash
# 检查是否有数据库锁文件
ls -la ~/Library/Application\ Support/com.jobpilot.app/ | grep -E "lock|journal"
```

**解决方案：**
```bash
# 1. 关闭应用
pkill -9 jobpilot

# 2. 删除锁文件
rm -f ~/Library/Application\ Support/com.jobpilot.app/*.lock
rm -f ~/Library/Application\ Support/com.jobpilot.app/*.journal

# 3. 重启应用
open /Applications/JobPilot.app
```

### 3️⃣ **验证失败（字段为空或无效）**

**问题描述：**
某些必填字段为空或验证失败

**必填字段检查：**
- ✅ 配置名称 (name) - 必填
- ✅ 协议 (provider) - 必填，只能是 `openai_compatible` 或 `anthropic_compatible`
- ✅ API Key (apiKey) - 必填
- ✅ Base URL (baseUrl) - 必填
- ✅ 模型名称 (model) - 必填
- ⭕ 多模态模型 (multimodalModel) - 可选

**验证协议类型：**
确保选择的协议类型正确：
```
OpenAI 兼容 → 应该是 "openai_compatible"
Anthropic 兼容 → 应该是 "anthropic_compatible"
```

### 4️⃣ **浏览器控制台错误**

**检查步骤：**
1. 打开应用
2. 按 **Command + Option + I** 打开开发者工具
3. 切换到 **Console** 标签
4. 尝试保存配置
5. 查看是否有红色错误信息

**常见错误消息：**
```
❌ "provider must be 'openai_compatible' or 'anthropic_compatible'"
   → 协议类型错误

❌ "Database is locked"
   → 数据库被锁定，使用解决方案 2

❌ "TypeError: Cannot read property 'xxx' of undefined"
   → 前端代码错误，需要重新构建应用
```

---

## 完整的故障排查步骤

### 步骤 1: 清理并重启
```bash
# 关闭应用
pkill -9 jobpilot

# 备份数据库（以防万一）
cp ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db \
   ~/Desktop/jobpilot_backup_$(date +%s).db

# 删除锁文件
rm -f ~/Library/Application\ Support/com.jobpilot.app/*.lock
rm -f ~/Library/Application\ Support/com.jobpilot.app/*.journal

# 重新启动应用
open /Applications/JobPilot.app
```

### 步骤 2: 打开开发者工具并监控
```
1. 打开应用后按 Command + Option + I
2. 切换到 Console 标签
3. 切换到 Network 标签
```

### 步骤 3: 尝试保存配置
```
1. Settings ⚙️ → AI Config
2. + Add New Config
3. 填写所有必填字段：
   - 配置名称: "Test Config"
   - 协议: "OpenAI Compatible"
   - API 地址: "https://api.deepseek.com/v1"
   - 模型: "deepseek-chat"
   - API Key: "任意字符串用于测试"
4. 点击保存按钮
5. 观察控制台是否有错误
```

### 步骤 4: 检查数据库
```bash
# 查看数据库中的配置
sqlite3 ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db \
  "SELECT id, name, provider, model FROM ai_provider_config;"
```

---

## 快速修复清单

- [ ] 检查所有必填字段是否填写
- [ ] 确认协议类型选择正确
- [ ] 关闭应用并删除数据库锁文件
- [ ] 重启应用后重试
- [ ] 打开开发者工具查看具体错误
- [ ] 检查浏览器控制台是否有红色错误

---

## 如果还是不行

### 完全重置应用

```bash
# 1. 关闭应用
pkill -9 jobpilot

# 2. 删除应用数据（这会清除所有配置和职位数据！）
rm -rf ~/Library/Application\ Support/com.jobpilot.app/

# 3. 重启应用（会重新初始化数据库）
open /Applications/JobPilot.app

# 4. 创建新配置
```

### 重建应用

```bash
# 如果问题持续存在，可以重新构建应用
cd /Users/bingo/Desktop/04_Coding/20_Projects/20_JobPilot

# 清理构建
rm -rf src-tauri/target/

# 重新构建
npm run build

# 或者直接从 DMG 重新安装
```

---

## 技术细节（供开发者参考）

### 后端 API 签名

```rust
#[tauri::command]
pub fn ai_config_create(
    input: AiConfigCreateInput,  // ← 参数名必须是 "input"
    state: State<'_, AppState>,
) -> Result<AiProviderConfig, String>
```

### AiConfigCreateInput 结构

```rust
pub struct AiConfigCreateInput {
    pub name: String,              // 配置名称
    pub provider: String,          // "openai_compatible" 或 "anthropic_compatible"
    pub api_key: String,           // API 密钥
    pub base_url: Option<String>,  // API 地址
    pub model: String,             // 模型名称
    pub multimodal_model: Option<String>, // 可选的多模态模型
    pub is_active: Option<bool>,   // 可选的激活状态
}
```

### 前端调用方式

```typescript
// 正确的方式
await aiConfigsApi.create({
  name: "My Config",
  provider: "openai_compatible",  // ← 必须完全匹配
  apiKey: "sk-...",
  baseUrl: "https://...",
  model: "gpt-4",
  multimodalModel: "gpt-4-vision",
  isActive: true,
});
```

---

## 联系支持

如果按照以上步骤操作后问题仍未解决，请提供：

1. **错误信息** - 开发者工具中的具体错误
2. **数据库内容** - 运行以下命令的输出：
   ```bash
   sqlite3 ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db \
     ".schema ai_provider_config"
   sqlite3 ~/Library/Application\ Support/com.jobpilot.app/jobpilot.db \
     "SELECT * FROM ai_provider_config;"
   ```
3. **填写的值** - 你在表单中填写的具体值（不含真实 API Key）
4. **系统信息** - `sw_vers` 命令的输出

---

希望这个指南能帮助你解决问题！

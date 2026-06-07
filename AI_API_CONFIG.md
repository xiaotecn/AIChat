# 🤖 AI API 配置指南

本指南将帮助你配置 AI 服务，让聊天功能支持真实的 AI 对话。

---

## 📋 支持的 AI 服务

### 1. OpenAI (推荐)
- ✅ GPT-3.5 Turbo - 快速且经济
- ✅ GPT-4 - 最强大的模型
- ✅ GPT-4 Turbo - 平衡性能和成本

### 2. Anthropic Claude
- ✅ Claude 3 Opus - 最强大
- ✅ Claude 3 Sonnet - 平衡
- ✅ Claude 3 Haiku - 快速

### 3. 其他服务
- Google Gemini
- Azure OpenAI
- 任何兼容 OpenAI 格式的 API

---

## 🚀 快速开始（OpenAI）

### 步骤 1: 获取 API Key

1. 访问 https://platform.openai.com
2. 注册或登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create new secret key**
5. 复制生成的 API Key（格式：`sk-...`）

### 步骤 2: 配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
# OpenAI 配置
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
```

如果 `.env` 文件不存在，创建它：

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

### 步骤 3: 重启服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### 步骤 4: 测试

访问 http://localhost:3000/chat，发送一条消息，应该能看到真实的 AI 响应！

---

## 🔧 详细配置

### OpenAI 完整配置

```env
# API Key（必需）
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# API 基础 URL（可选，默认为官方地址）
OPENAI_BASE_URL=https://api.openai.com/v1

# 默认模型（可选）
OPENAI_MODEL=gpt-3.5-turbo

# 组织 ID（可选，如果你有多个组织）
OPENAI_ORG_ID=org-xxxxxxxxxxxxxxxxxxxxx
```

### Anthropic Claude 配置

```env
# Claude API Key
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
CLAUDE_BASE_URL=https://api.anthropic.com/v1
CLAUDE_MODEL=claude-3-sonnet-20240229
```

### Azure OpenAI 配置

```env
# Azure OpenAI
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_API_VERSION=2024-02-01
```

---

## 💰 费用说明

### OpenAI 定价（2024）

| 模型 | 输入价格 | 输出价格 |
|-----|---------|---------|
| GPT-3.5 Turbo | $0.0005 / 1K tokens | $0.0015 / 1K tokens |
| GPT-4 | $0.03 / 1K tokens | $0.06 / 1K tokens |
| GPT-4 Turbo | $0.01 / 1K tokens | $0.03 / 1K tokens |

**示例成本：**
- 一次普通对话（~500 tokens）：GPT-3.5 约 $0.001，GPT-4 约 $0.045

### 免费额度

- **OpenAI**: 新用户赠送 $5 额度（3个月有效）
- **Claude**: 提供免费 tier

---

## 🌍 使用国内中转服务

如果无法直接访问 OpenAI，可以使用中转服务：

### 选项 1: OpenAI 中转 API

```env
OPENAI_API_KEY=你的中转API-Key
OPENAI_BASE_URL=https://your-proxy-service.com/v1
```

**推荐中转服务：**
- OpenAI-SB
- API2D
- CloseAI

### 选项 2: 自建代理

使用 Cloudflare Workers 或其他服务自建代理。

---

## 🔒 安全建议

### 1. 保护 API Key

- ❌ **不要**将 API Key 提交到 Git
- ❌ **不要**在前端代码中暴露 API Key
- ✅ **务必**将 `.env` 添加到 `.gitignore`
- ✅ **使用**环境变量管理密钥

### 2. 限制使用

在 OpenAI 控制台设置：
- 使用限额（Usage limits）
- IP 白名单
- 速率限制

### 3. 监控成本

- 定期检查 API 使用情况
- 设置预算提醒
- 使用更经济的模型（如 GPT-3.5）

---

## 🧪 测试 API 连接

### 方法 1: 使用 curl 测试

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 方法 2: 在应用中测试

访问聊天页面，发送：
```
你好，请介绍一下你自己
```

如果返回的是真实 AI 响应（而不是模拟响应），说明配置成功！

---

## 🐛 常见问题

### 问题 1: API Key 无效

**错误**: `Incorrect API key provided`

**解决方案**:
1. 检查 API Key 是否正确复制（包括 `sk-` 前缀）
2. 确认 API Key 未过期
3. 检查账户是否有可用额度

### 问题 2: 网络连接失败

**错误**: `Failed to fetch` 或超时

**解决方案**:
1. 检查网络连接
2. 尝试使用中转服务
3. 检查防火墙设置

### 问题 3: 配额不足

**错误**: `You exceeded your current quota`

**解决方案**:
1. 访问 OpenAI 控制台充值
2. 或使用免费的替代服务

### 问题 4: 环境变量未生效

**解决方案**:
1. 确认 `.env` 文件在项目根目录
2. 重启开发服务器
3. 检查变量名拼写是否正确

---

## 📝 示例配置文件

创建 `.env` 文件（完整示例）：

```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_chat"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxx"
OPENAI_BASE_URL="https://api.openai.com/v1"

# 可选：Claude
# CLAUDE_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxxx"
# CLAUDE_BASE_URL="https://api.anthropic.com/v1"
```

---

## 🎯 下一步

配置完成后：

1. ✅ 重启开发服务器
2. ✅ 访问聊天页面测试
3. ✅ 在管理后台配置更多模型
4. ✅ 查看调用日志监控使用情况

---

## 📚 相关文档

- [OpenAI API 文档](https://platform.openai.com/docs)
- [Anthropic Claude 文档](https://docs.anthropic.com)
- [项目 API 文档](./API.md)
- [设置指南](./SETUP.md)

---

**🎉 配置完成后，你就可以使用真实的 AI 对话功能了！**

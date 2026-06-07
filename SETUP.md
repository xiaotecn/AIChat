# 🚀 AI Chat 完整设置指南

这是一份完整的从零开始搭建 AI Chat 项目的指南。

---

## 📋 目录

1. [环境准备](#环境准备)
2. [安装依赖](#安装依赖)
3. [数据库配置](#数据库配置)
4. [启动项目](#启动项目)
5. [初始登录](#初始登录)
6. [AI API 配置](#ai-api-配置)
7. [常见问题](#常见问题)

---

## 1️⃣ 环境准备

### 必需软件
- **Node.js** 18.18+
- **PostgreSQL** 14+（或使用 Docker）
- **npm** 或 **pnpm**

### 检查版本
```bash
node --version    # v18.18.0 或更高
npm --version     # 9.0.0 或更高
```

---

## 2️⃣ 安装依赖

```bash
# 进入项目目录
cd ai-chat-app

# 安装依赖
npm install

# 等待安装完成...
```

---

## 3️⃣ 数据库配置

### 选项 A: 使用 Docker（推荐）

```bash
# 启动 PostgreSQL 容器
docker run --name ai-chat-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=ai_chat \
  -p 5432:5432 \
  -d postgres:14

# 检查容器状态
docker ps
```

### 选项 B: 使用本地 PostgreSQL

```bash
# macOS
brew install postgresql@14
brew services start postgresql@14
createdb ai_chat

# Windows
# 下载安装包: https://www.postgresql.org/download/windows/

# Linux
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb ai_chat
```

### 配置环境变量

1. 复制 `.env.example` 为 `.env`
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件
```env
# 数据库连接
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ai_chat?schema=public"

# 认证密钥（生产环境请更改）
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# AI API 配置（可选，稍后配置）
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 初始化数据库

```bash
# 1. 生成 Prisma 客户端
npx prisma generate

# 2. 创建数据库表
npx prisma db push

# 3. 播种初始数据
npx prisma db seed

# 4. 查看数据库（可选）
npx prisma studio
```

**初始数据说明:**
- 管理员账号: `admin@example.com` / `admin123456`
- 测试用户: `zhangsan@example.com` / `test123456`
- 3 个套餐: 免费版、专业版、企业版
- AI 提供商和模型配置

---

## 4️⃣ 启动项目

```bash
# 启动开发服务器
npm run dev
```

等待编译完成，看到：
```
✓ Ready in 513ms
- Local:   http://localhost:3000
- Network: http://192.168.1.12:3000
```

---

## 5️⃣ 初始登录

### 访问应用

1. **首页**: http://localhost:3000
2. **移动端**: http://localhost:3000/chat
3. **管理后台**: http://localhost:3000/admin

### 默认账号

| 角色 | 邮箱 | 密码 |
|-----|------|------|
| 管理员 | admin@example.com | admin123456 |
| 测试用户 | zhangsan@example.com | test123456 |
| 测试用户 | lisi@example.com | test123456 |

**注意**: 目前认证功能尚未实现，可以直接访问所有页面。

---

## 6️⃣ AI API 配置

### OpenAI 配置

1. 获取 API Key: https://platform.openai.com/api-keys
2. 在管理后台配置: http://localhost:3000/admin/providers
3. 或更新 `.env`:
```env
OPENAI_API_KEY="sk-your-api-key"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### Claude (Anthropic) 配置

```env
CLAUDE_API_KEY="sk-ant-your-api-key"
CLAUDE_BASE_URL="https://api.anthropic.com/v1"
```

---

## 🎯 验证安装

### 检查清单

- [ ] ✅ 依赖安装成功 (`npm install`)
- [ ] ✅ 数据库运行中
- [ ] ✅ 环境变量配置完成 (`.env`)
- [ ] ✅ Prisma 生成成功 (`npx prisma generate`)
- [ ] ✅ 数据库初始化完成 (`npx prisma db push`)
- [ ] ✅ 种子数据导入成功 (`npx prisma db seed`)
- [ ] ✅ 开发服务器启动 (`npm run dev`)
- [ ] ✅ 可以访问首页 (http://localhost:3000)
- [ ] ✅ 可以访问管理后台 (http://localhost:3000/admin)

### 功能测试

1. **首页访问** - 显示欢迎页面
2. **移动端聊天** - 可以发送消息
3. **管理后台** - 所有页面可访问
4. **数据看板** - 显示统计数据
5. **用户管理** - 显示用户列表
6. **API 接口** - `curl http://localhost:3000/api/admin/stats`

---

## 📚 下一步

安装完成后，你可以：

1. **开发新功能** - 参考 [FINAL_DELIVERY.md](./FINAL_DELIVERY.md)
2. **接入 AI API** - 修改 `/api/chat/route.ts`
3. **实现认证** - 安装 NextAuth.js
4. **部署到生产** - Vercel / Railway / Docker

---

## 🆘 需要帮助？

- 查看 [API 文档](./API.md)
- 查看 [数据库指南](./DATABASE.md)
- 查看 [项目总结](./FINAL_DELIVERY.md)
- 查看 [管理后台指南](./ADMIN_GUIDE.md)

---

## 🎉 安装完成！

恭喜你完成了 AI Chat 的安装！现在可以开始开发了。

访问 http://localhost:3000 开始体验！

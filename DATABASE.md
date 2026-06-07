# 数据库配置指南

## 📋 前置要求

- PostgreSQL 14+ 已安装并运行
- 已创建数据库

---

## 🚀 快速开始

### 1. 安装 PostgreSQL

**Windows (推荐使用 Docker)**
```bash
# 使用 Docker 运行 PostgreSQL
docker run --name ai-chat-postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=ai_chat -p 5432:5432 -d postgres:14

# 或者下载安装包
# https://www.postgresql.org/download/windows/
```

**macOS**
```bash
brew install postgresql@14
brew services start postgresql@14
createdb ai_chat
```

**Linux**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb ai_chat
```

---

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
# .env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ai_chat?schema=public"
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

**数据库 URL 格式:**
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=public
```

---

### 3. 初始化数据库

```bash
# 生成 Prisma 客户端
npx prisma generate

# 创建数据库表结构
npx prisma db push

# 查看数据库
npx prisma studio
```

---

### 4. 播种初始数据

```bash
# 运行种子脚本
npx prisma db seed
```

**初始数据包括:**
- ✅ 系统设置
- ✅ 3 个套餐（免费版、专业版、企业版）
- ✅ 管理员账号: admin@example.com / admin123456
- ✅ 2 个测试用户: zhangsan@example.com / test123456
- ✅ AI 提供商配置
- ✅ AI 模型列表

---

## 📊 数据库表结构

### User（用户表）
- id, name, email, passwordHash
- role（admin/user）
- planId（套餐ID）
- usedTokens, usedMessages（使用量）
- status（active/inactive）

### Plan（套餐表）
- id, name, description
- tokenLimit, messageLimit
- price, resetCycle
- enabled

### Conversation（会话表）
- id, title, modelId
- userId（关联用户）
- messages（一对多关联）

### Message（消息表）
- id, role, content
- conversationId（关联会话）
- tokens

### AiProvider（AI 提供商表）
- id, name, baseUrl, apiKey
- enabled

### AiModel（AI 模型表）
- id, providerId, code, name
- contextLength, enabled

### SystemSettings（系统设置表）
- id, siteName, announcement
- registrationMode, defaultPlanId

---

## 🔄 常用命令

### 查看数据库
```bash
npx prisma studio
```
访问 http://localhost:5555

### 重置数据库
```bash
# 警告：会删除所有数据！
npx prisma db push --force-reset
npx prisma db seed
```

### 更新数据库结构
```bash
# 修改 schema.prisma 后执行
npx prisma db push
```

---

## 🐳 使用 Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    container_name: ai-chat-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: yourpassword
      POSTGRES_DB: ai_chat
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

启动：
```bash
docker-compose up -d
```

---

## 📝 生产环境推荐

### Supabase (推荐)

1. 访问 https://supabase.com
2. 创建项目
3. 获取连接字符串
4. 配置 DATABASE_URL

```bash
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"
```

---

## 🎯 下一步

数据库配置完成后：

1. ✅ 运行 `npx prisma studio` 查看数据
2. ✅ 使用 admin@example.com / admin123456 登录
3. ✅ 开始开发 API 集成
4. ✅ 实现用户认证

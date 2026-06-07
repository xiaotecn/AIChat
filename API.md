# API 文档

## 📖 API 接口说明

本项目提供了完整的 REST API 接口，用于管理用户、套餐、AI 提供商等资源。

---

## 🔐 认证（待实现）

所有管理后台 API 都需要管理员权限。

```
Authorization: Bearer <token>
```

---

## 👥 用户管理 API

### 获取用户列表

```
GET /api/admin/users
```

**查询参数**:
- `search` - 搜索关键词（用户名或邮箱）
- `role` - 角色筛选（admin/user）
- `status` - 状态筛选（active/inactive）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "张三",
      "email": "zhangsan@example.com",
      "role": "user",
      "planId": "free",
      "usedTokens": 12500,
      "usedMessages": 45,
      "tokenLimit": 50000,
      "messageLimit": 100,
      "status": "active",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "total": 3
}
```

### 创建用户

```
POST /api/admin/users
```

**请求体**:
```json
{
  "name": "新用户",
  "email": "newuser@example.com",
  "role": "user",
  "planId": "free"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "4",
    "name": "新用户",
    "email": "newuser@example.com",
    "role": "user",
    "planId": "free",
    "usedTokens": 0,
    "usedMessages": 0,
    "status": "active",
    "createdAt": "2024-01-20T10:30:00.000Z"
  },
  "message": "用户创建成功"
}
```

### 更新用户

```
PATCH /api/admin/users/:id
```

**请求体**:
```json
{
  "name": "更新后的名字",
  "role": "admin",
  "status": "inactive"
}
```

### 删除用户

```
DELETE /api/admin/users/:id
```

---

## 💳 套餐管理 API

### 获取套餐列表

```
GET /api/admin/plans
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "free",
      "name": "免费版",
      "description": "适合个人体验",
      "tokenLimit": 50000,
      "messageLimit": 100,
      "price": 0,
      "features": ["基础对话", "历史记录", "社区支持"],
      "enabled": true,
      "users": 856
    }
  ]
}
```

### 创建套餐

```
POST /api/admin/plans
```

**请求体**:
```json
{
  "name": "高级版",
  "description": "适合高级用户",
  "tokenLimit": 300000,
  "messageLimit": 2000,
  "price": 49,
  "features": ["所有基础功能", "优先支持", "高级模型"]
}
```

### 更新套餐

```
PATCH /api/admin/plans/:id
```

### 删除套餐

```
DELETE /api/admin/plans/:id
```

---

## 📊 统计数据 API

### 获取统计数据

```
GET /api/admin/stats
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1234,
      "active": 856,
      "new": 154,
      "growth": 12.5
    },
    "conversations": {
      "total": 12450,
      "today": 523,
      "growth": 23.1
    },
    "tokens": {
      "total": 2400000,
      "today": 85000,
      "growth": 15.7
    },
    "userGrowth": [
      { "date": "1日", "count": 65 },
      { "date": "2日", "count": 78 }
    ],
    "recentActivities": [
      {
        "id": "1",
        "user": "张三",
        "action": "创建了新对话",
        "time": "2分钟前"
      }
    ]
  }
}
```

---

## 🤖 AI 提供商管理 API

### 获取提供商列表

```
GET /api/admin/providers
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-...UX8K",
      "enabled": true,
      "models": ["gpt-3.5-turbo", "gpt-4"],
      "requests": 12450,
      "lastTest": "2024-01-20 14:30"
    }
  ]
}
```

### 创建提供商

```
POST /api/admin/providers
```

**请求体**:
```json
{
  "name": "OpenAI",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "models": ["gpt-3.5-turbo", "gpt-4"]
}
```

---

## 📝 调用日志 API

### 获取日志列表

```
GET /api/admin/logs
```

**查询参数**:
- `status` - 状态筛选（success/error）
- `model` - 模型筛选

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "user": "zhangsan@example.com",
      "action": "发送消息",
      "model": "gpt-3.5-turbo",
      "tokens": 450,
      "status": "success",
      "message": "如何学习 React？",
      "time": "2024-01-20 14:35:22"
    }
  ],
  "total": 3
}
```

---

## 💬 聊天 API

### 发送消息

```
POST /api/chat
```

**请求体**:
```json
{
  "conversationId": "conv_123",
  "message": "你好，请介绍一下自己"
}
```

**响应示例**:
```json
{
  "message": "你好！我是 AI 助手...",
  "conversationId": "conv_123"
}
```

---

## 🔄 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "错误信息描述"
}
```

---

## 📌 状态码

| 状态码 | 说明 |
|-------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 🚀 使用示例

### JavaScript / Fetch

```javascript
// 获取用户列表
const response = await fetch('/api/admin/users?search=张三')
const data = await response.json()

// 创建用户
const response = await fetch('/api/admin/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '新用户',
    email: 'newuser@example.com'
  })
})
```

### cURL

```bash
# 获取统计数据
curl http://localhost:3000/api/admin/stats

# 创建套餐
curl -X POST http://localhost:3000/api/admin/plans \
  -H "Content-Type: application/json" \
  -d '{"name":"高级版","tokenLimit":300000,"messageLimit":2000,"price":49}'
```

---

## 📝 注意事项

1. **数据持久化**: 当前 API 使用内存数据，重启后数据会丢失。生产环境需要连接数据库。

2. **认证鉴权**: 当前未实现认证，所有 API 都可以直接访问。生产环境需要添加认证中间件。

3. **参数验证**: 当前仅做了基础验证，生产环境建议使用 Zod 等库进行完整验证。

4. **错误处理**: 当前使用了基础的 try-catch，生产环境建议添加统一的错误处理中间件。

---

## 🔜 待实现功能

- [ ] 用户认证和授权
- [ ] 数据库持久化
- [ ] 参数验证（Zod）
- [ ] 统一错误处理
- [ ] 分页功能
- [ ] 排序功能
- [ ] 批量操作
- [ ] 导出数据
- [ ] WebSocket 实时通知

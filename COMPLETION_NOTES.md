# 本次完善记录（2026-06-04）

> 之前的文档（PRODUCTION_READY.md 等）把许多“已完成”写得过于乐观，实际存在多处**编译失败**与**前后端脱节**。本次对照真实代码逐项修复，并已通过 `npm run build` + 真实接口冒烟测试验证。

## 一、修复的编译错误（项目原本无法构建）

| 问题 | 文件 | 修复 |
|------|------|------|
| Next.js 16 动态路由 `params` 现为 `Promise`，旧写法类型报错 | `app/api/admin/{plans,users,providers}/[id]/route.ts` | 改为 `params: Promise<{id}>` 并 `await params` |
| Tailwind v4 `darkMode` 类型不匹配 | `tailwind.config.ts` | `["class"]` → `"class"` |

> 参见 `AGENTS.md`：此版本 Next.js 有破坏性变更，已据 `node_modules/next/dist/docs` 修正。

## 二、打通的核心断层（原本“假后端”）

### 1. 聊天真正使用后台配置的 AI 提供商 ✅
原 `/api/chat/stream` 只读取环境变量 `OPENAI_API_KEY`，**完全忽略后台配置的提供商**——管理后台的“AI 接口管理”形同虚设。

现在（`lib/ai.ts` + `app/api/chat/stream/route.ts`）：
- 按模型代码在数据库中解析「已启用提供商 + 已启用模型」
- 容错：提供商已启用且有可用 Key、即使尚未导入模型也能直接使用
- 解析顺序：DB 精确模型 → DB 任一可用提供商 → 环境变量 → 模拟回复
- 占位 Key（含 `placeholder`）自动跳过
- **支持多轮上下文**（前端传 `history`，最多保留最近 20 条）

### 2. 调用日志变为真实数据 ✅
- `/api/admin/logs` 原本返回**写死的假数据**（张三/李四/王五，2024 年），现改为查询真实 `ApiLog` 表
- 每次聊天调用都会写入 `ApiLog`（提供商、模型、用户、token、状态、耗时信息）
- 同时累加用户的 `usedTokens` / `usedMessages`

### 3. AI 模型管理（原本完全缺失）✅
后台“导入模型”按钮原是**无任何动作的死按钮**，导致提供商配了 Key 也无法选模型。
新增：
- `POST /api/admin/providers/[id]/models/import` — 一键从提供商 `/v1/models` 导入（兼容 OpenAI 格式）
- `POST /api/admin/providers/[id]/models` — 手动添加模型
- `DELETE|PATCH /api/admin/models/[id]` — 删除 / 启停模型
- 提供商页面新增「管理模型」弹窗（导入 / 手动添加 / 列表删除）

### 4. 系统设置可真正保存 ✅
原 `/admin/settings` 是纯静态页（输入框无状态、保存按钮无动作、无对应接口）。
新增 `GET|PATCH /api/admin/settings`（基于 `SystemSettings`），页面改为受控表单，加载并保存站点名称、描述、公告、注册模式、默认套餐。
> Schema 新增了 `SystemSettings.description` 字段（已 `prisma db push`）。

### 5. 聊天模型选择器 ✅
- 新增 `GET /api/models`（仅返回已启用提供商下的已启用模型）
- 聊天顶栏新增模型下拉框，选择结果存入 store 并随会话发送
- 用户密码可在后台编辑时可选修改（原 `users/[id]` PATCH 不处理密码）

## 三、已验证（真实冒烟测试）
- ✅ 从用户真实中转提供商「测试」一键导入 **12 个 Grok 模型**
- ✅ 聊天经该提供商返回真实流式回复（客户端实际收到流式字节）
- ✅ `ApiLog` 写入真实记录，`/admin/logs` 正确展示
- ✅ 设置 GET/PATCH 持久化
- ✅ `npm run build` 全绿；10 个页面均 HTTP 200

## 四、仍存在的已知局限（非阻塞）
- `/admin`(数据看板) 的**营收 / 转化率 / 增长率 / 7 日趋势图**仍是装饰性假数据（用户/会话/消息/Token 计数是真实的）；当前 schema 无支付与历史快照数据，无法真实计算。
- 个人中心「设置」按钮仍为 `alert('功能开发中')`（无用户级设置页）。
- `/api/chat/route.ts`（非流式）是未被使用的模拟代码，保留未删。
- **无登录鉴权**：聊天用户为前端 store 中的演示用户，会话存于 localStorage；管理后台未鉴权。若要正式上线需接入认证（如 NextAuth）。

---

# 第二轮完善（2026-06-04）：认证 + 真实看板 + 清理

上一轮遗留的 4 项局限本轮已全部处理。

## 五、登录鉴权系统（全新）✅
按 Next.js 16 官方文档实现（**注意：Next 16 已将 Middleware 更名为 Proxy**，`proxy.ts`，运行于 Node 运行时）。
- `lib/session.ts` — 无依赖的会话令牌：Web Crypto **HMAC-SHA256** 签名（兼容 Node/Edge），使用 `NEXTAUTH_SECRET`。
- `lib/auth.ts` — `getSession` / `setSessionCookie` / `clearSessionCookie` / `getCurrentUser`（httpOnly Cookie，7 天有效）。
- 认证接口：`POST /api/auth/login`、`POST /api/auth/register`（按系统设置的注册模式开放）、`POST /api/auth/logout`、`GET /api/auth/me`。
- `proxy.ts` — 校验签名令牌（role 声明经 HMAC 签名不可伪造，属真实拦截）：
  - `/api/admin/*` 与 `/admin/*`：要求管理员（否则 401 / 重定向）
  - `/api/*` 业务接口：要求登录
  - `/chat`、`/history`、`/profile`：未登录跳 `/login`
  - 已登录访问 `/login`、`/register` → 跳对应首页
- `app/login`、`app/register` 页面；`AuthGate` 组件在布局中通过 `/api/auth/me` 水合真实用户。
- 后台侧栏显示真实管理员并支持**退出登录**；聊天/个人中心使用真实登录用户（store 默认用户改为 `null`）。

**已验证**（curl + Cookie）：未登录 401/重定向、错误密码 401、管理员登录得 Cookie、带 Cookie 访问后台 200、登出后失效、注册新用户成功、普通用户访问后台被拦截（401 / 跳 `/chat`）。

## 六、数据看板改为真实计算 ✅
`/api/admin/stats` 不再返回写死的营收/转化/增长/趋势：
- 用户总数 / 活跃数 / 活跃占比、用户周环比增长 — 真实计算
- “AI 调用数 / Token 消耗” 来自真实 `ApiLog`（今日 / 总量 / 周环比）
- 7 日新增用户柱状图 — 真实按天分桶（图表高度按最大值归一）
- 移除了未被使用的 revenue / conversion 假字段
- 看板页“活跃用户”原本写死的 `+8.2%` 改为真实活跃占比

## 七、清理 ✅
- 删除未使用的 `app/api/chat/route.ts`（非流式模拟）
- 个人中心「设置」死按钮 → 管理员显示「管理后台」入口；退出登录改为调用 `/api/auth/logout`
- 后台“刷新数据”按钮接通（重新加载）

## 仍存在的局限（非阻塞）
- 聊天**会话仍存于浏览器 localStorage**（非按用户存数据库）。已有 `/api/conversations`、`/api/messages` 接口可用，但聊天 UI 尚未切换为 DB 持久化；同一浏览器多账号会共享本地会话。若需云端同步/多端，需将聊天改为 DB 持久化（按 `userId`）。
- `registrationMode = invite` 暂等同于关闭自助注册（未实现邀请码系统）。
- 生产部署前请将 `.env` 的 `NEXTAUTH_SECRET` 改为随机强密钥（`openssl rand -base64 32`），并在 HTTPS 下启用（Cookie 在生产自动加 `secure`）。

## 默认账号
- 管理员：`admin@example.com` / `admin123456`
- 测试用户：`zhangsan@example.com`、`lisi@example.com` / `test123456`

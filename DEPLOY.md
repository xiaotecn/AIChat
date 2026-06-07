# 上线部署手册（DEPLOY）

智能海豹 / ai-chat-app — Next.js 16 + React 19 + Prisma(SQLite)。本文是把它从开发跑到「正式运营」的清单。

> ⚠️ **部署形态硬约束：必须是常驻 Node 进程（`next start`，跑在 VPS / Docker / 自管服务器）。**
> 不能用 Vercel / Netlify 等 serverless 函数平台——生图是「响应返回后在后台继续跑」的任务，
> serverless 会在响应后冻结/回收进程，生图会永远卡在 pending。

---

## 🐳 用 Docker / 1Panel 部署（推荐，2G 也能跑）

仓库已带：`Dockerfile`(多阶段)、`docker-compose.yml`、`docker-entrypoint.sh`、`.dockerignore`。
运行镜像基于 Next standalone，**运行时很省内存**，适合 2G。

> ⚠️ **构建仍吃内存**：`docker build` 内部会跑 `next build`（峰值 ~1–1.5G），2G 机上可能 OOM。二选一：
> - **先加 swap 再构建**（最省事）：
>   ```bash
>   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
>   ```
> - 或在开发机/CI 构建好镜像推到仓库，服务器只 `pull` + 跑（完全不在 2G 上构建）。

**密钥连续性（最重要）**：compose 注入的两把密钥**必须与现网 `.env` 里的值一模一样**——
`NEXTAUTH_SECRET` 改了所有人要重新登录；`ENCRYPTION_KEY` 改了**后台已存的服务商 API Key 解不开、AI 直接挂**。
放进「与 `docker-compose.yml` 同目录」的 `.env`：
```
NEXTAUTH_SECRET=（粘贴现网那串）
ENCRYPTION_KEY=（粘贴现网那串）
```

**数据持久化**：compose 把宿主 `./data` 挂到容器 `/app/data`，内含 `dev.db` 与 `uploads/`。
- 备份 = 备份 `./data` 即可。
- 首次启动若 `./data/dev.db` 不存在，用镜像内置种子库初始化（管理员 `admin@example.com / admin123456` + 套餐 + 默认分组）。
- **想用现网已有库**：先把它放到 `./data/dev.db` 再启动（已存在则不覆盖）。⚠️ 旧结构库先在开发机对它 `npx prisma db push` 补上新列（图片额度/消息状态等）再上传。

**1Panel 操作**：
1. 项目目录传到服务器（如 `/opt/zhinenghaibao`），在该目录建 `.env` 填上面两把密钥。
2. 1Panel →「容器」→「编排」→ 指向该目录的 `docker-compose.yml` → 构建并启动。
3. 1Panel →「网站」建反代到 `127.0.0.1:3000`，**一键开 HTTPS**，域名指过去。
4. 打开站点，**立刻改默认管理员口令**。

**更新代码**：重新 `docker compose build && docker compose up -d`。运行时**不自动改表结构**——
新版本若有 schema 变更，需对 `./data/dev.db` 跑一次 `prisma db push`（开发机对副本跑后替换）；全新库无此问题（内置种子库已是新结构）。

---

## 1. 前提
- Node ≥ 20
- 一台常驻服务器（或容器）+ 反向代理（Nginx/Caddy）提供 **HTTPS**
  - 生产 Cookie 是 `secure` 的，**没有 HTTPS 登录态发不出去**，必须 HTTPS。

## 2. 环境变量（见 `.env.example`）
- `NEXTAUTH_SECRET`（**必填**）：会话签名密钥。不设会用公开默认值，**会话可被伪造**。生成：`openssl rand -base64 32`。
- `ENCRYPTION_KEY`（**必填**）：provider API Key 的 AES-256-GCM 加密密钥。**改了会使后台已存的服务商 key 解不开**。
- `DATABASE_URL`：SQLite 路径（schema 现已读此变量）。本地 `.env` 是 `file:./dev.db`；Docker 里指到数据卷 `file:/app/data/dev.db`。
  - 注：本地把 schema 从写死改成 `env("DATABASE_URL")` 后，跑一次 `npx prisma generate` 即可（`.env` 已有该值，路径不变）。
- `UPLOAD_DIR`：生成图片落盘目录。Docker 里 `/app/data/uploads`（随数据卷持久化）。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`（可选）：未在后台配置任何服务商时的兜底默认上游。

## 3. 数据库
```bash
npx prisma generate          # 生成 client（改 schema 后必跑）
npx prisma db push           # 把 schema 同步到 dev.db（首次/有结构变更时）
npx prisma db seed           # 仅全新库需要：建套餐/默认分组/管理员
```
- **持久化**：`dev.db` 必须放在持久化、定期备份的卷（Docker 下挂 volume，别留在容器层）。
- **备份**：定时 `cp dev.db` 或 `sqlite3 dev.db ".backup"`。
- **建议开 WAL**（更好的读写并发）：`sqlite3 dev.db "PRAGMA journal_mode=WAL;"`（一次性，持久生效）。
- 规模化（高并发）再考虑迁 Postgres：改 `schema.prisma` 的 datasource → `db push` → 迁数据。

## 4. 构建与运行
```bash
npm ci
npx prisma generate
npm run build                # next build，产物在 .next/
NEXTAUTH_SECRET=... npm run start   # next start，常驻进程（用 pm2 / systemd / docker 守护）
```
- 用 `pm2` 或 `systemd` 保活、开机自启、崩溃重启。
- 反代把 `:3000` 暴露为 HTTPS；务必透传 `X-Forwarded-For`（限流按它取客户端 IP）。

## 5. 上线后立即做的安全项 🔴
1. **改默认管理员口令**：seed 的 `admin@example.com / admin123456` 是公开口令。
   登录后台改密码（或新建管理员、停用默认账号）。
2. **确认 `NEXTAUTH_SECRET` 已设**（看启动日志没有那条 ⚠️ 告警）。
3. **确认注册模式**：后台「系统设置」→ 开放/邀请/关闭。开放注册时新用户自动分配 `free` 套餐（含额度）。
4. 确认后台「AI 服务商」里只放**你自己的真实 key**，且各套餐的 token/消息/图片额度符合预期。

## 6. 已内置的防护
- 认证：bcrypt 口令哈希、httpOnly + 生产 secure Cookie、HMAC 签名会话、接口按会话鉴权 + 会话归属隔离。
- 限流（内存、单实例）：登录 10 次 / 5 分钟 / IP；注册 5 次 / 小时 / IP。
  - 多实例部署时内存不共享，需换 Redis 版限流。
- 额度：token / 消息 / 图片三套独立额度，按套餐周期惰性重置；图片采用「提交预扣、失败退还」。

## 7. 生成图片的持久化（已内置）
- 出图后会**把图片下载到本站落盘**（`runImageGenLoop` → `persistImage`），数据库只存站内路径
  `/api/uploads/<uuid>.<ext>`，由 `app/api/uploads/[name]` 服务。
  - 好处：上游临时链接过期也不影响（图片永久有效）；数据库不承载 base64/外链，**加载会话几乎不吃内存**。
  - 单张落盘失败会回退到原始地址（至少能即时显示，但那种可能会过期）。
- **落盘目录**：默认 `data/uploads`（cwd 下）。生产用 `UPLOAD_DIR` 指向**持久化、可备份的卷**
  （Docker 挂 volume；别留在容器层，否则重建即丢图）。记得一并备份。
- **更省内存（可选）**：让反向代理直接服务该目录，绕开 Node：
  ```nginx
  location /api/uploads/ { alias /data/uploads/; access_log off; expires max; }
  ```
- **已知小缺口**：重新生成（retry）会留下旧图的孤儿文件，暂不自动清理；磁盘紧张时可加定时 GC（按需再补）。
- 访问控制：图片路径含不可猜的 uuid，按「能力 URL」公开可读 + 永久缓存。若需严格按用户隔离，可再加鉴权（后续）。

## 8. 其他注意 🟡
- 头像存在数据库里（base64）。少量无妨；用户量大后头像会让 SQLite 涨，可同样挪到 `UPLOAD_DIR` / 对象存储。
- 暂无集中式错误监控（仅 `console.error`）；上量后建议接 Sentry 之类 + 结构化日志。
- 限流是单实例内存版；多实例部署需换 Redis 等共享存储。

## 9. 冒烟自检（可选）
仓库根的 `智能海豹` 目录下有多个 `smoke-*.mjs` 冒烟脚本（注册/登录/会话/归属隔离/额度/分组等）。
部署到预发后可跑一遍核对端到端。

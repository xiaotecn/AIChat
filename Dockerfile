# syntax=docker/dockerfile:1
# 多阶段构建：builder 装全量依赖、生成 Prisma Client、预置种子库、构建 Next standalone；
# runner 只带运行所需（standalone + 查询引擎 + 种子库），镜像小、内存省。
# 用 Debian slim（glibc）而非 alpine：Prisma 引擎在它上面最省心。

# ───────── deps：安装依赖（含 devDeps，构建/seed 用）─────────
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ───────── builder：生成 client + 预置种子库 + 构建 ─────────
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# schema 用 env("DATABASE_URL")；构建期给个临时路径，仅用于生成 client 与预置种子库。
ENV DATABASE_URL="file:/app/prisma/seed.db"
RUN npx prisma generate
# 预置「种子库」：建表 + 写入管理员/套餐/默认分组，供运行时首次启动初始化数据卷
# （这样 runner 无需 prisma CLI / ts-node）。
RUN npx prisma db push --skip-generate && npx prisma db seed
RUN npm run build

# ───────── runner：极简运行镜像 ─────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Next standalone 产物：自带最小 node_modules + server.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma Client + 查询引擎二进制（确保 standalone 没漏掉引擎；build 与 run 同为 node:20-slim，引擎匹配）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# 预置种子库（首次启动用它初始化数据卷）+ 入口脚本
COPY --from=builder /app/prisma/seed.db ./prisma/seed.db
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]

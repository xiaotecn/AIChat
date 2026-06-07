#!/bin/sh
set -e

# 数据库与上传目录：DATABASE_URL 形如 file:/app/data/dev.db，取出其文件路径
DB_FILE="${DATABASE_URL#file:}"
DATA_DIR="$(dirname "$DB_FILE")"
mkdir -p "$DATA_DIR" "${UPLOAD_DIR:-/app/data/uploads}"

# 首次部署（数据卷为空）→ 用镜像内预置的种子库初始化（含管理员/套餐/默认分组）。
# 已存在则保留不动（不会覆盖你导入的现网数据库）。
if [ ! -f "$DB_FILE" ]; then
  echo "[entrypoint] 数据库不存在，使用预置种子库初始化 → $DB_FILE"
  cp /app/prisma/seed.db "$DB_FILE"
else
  echo "[entrypoint] 检测到已有数据库 → $DB_FILE（保留不动）"
fi

# 关键密钥缺失时大声提示（不阻断启动）
[ -z "$NEXTAUTH_SECRET" ] && echo "[entrypoint] ⚠️ 未设置 NEXTAUTH_SECRET，会话可被伪造！"
[ -z "$ENCRYPTION_KEY" ] && echo "[entrypoint] ⚠️ 未设置 ENCRYPTION_KEY，provider key 将用回退密钥（与现网不一致会解不开历史密文）。"

echo "[entrypoint] 启动: $*"
exec "$@"

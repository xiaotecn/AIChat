// 极简内存限流（固定窗口）。适用于单实例常驻 Node 进程——本应用的部署形态。
// 多实例 / serverless 下各进程内存不共享，需换 Redis 等共享存储。
//
// 用法：const rl = rateLimit(`login:${ip}`, 10, 5 * 60_000)
//       if (!rl.ok) return 429 + { "Retry-After": String(rl.retryAfterSec) }

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  /** 距窗口重置的秒数（ok 为 false 时有意义），用于 Retry-After 响应头。 */
  retryAfterSec: number
}

/**
 * 固定窗口限流：同一 key 在 windowMs 内最多放行 limit 次，超出返回 ok=false。
 * 窗口到点后自动重置。内存占用随活跃 key 增长，超过阈值时顺手清理过期桶。
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // 机会式清理：防止长期运行下 Map 因海量一次性 key 无限增长
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k)
    }
    return { ok: true, retryAfterSec: 0 }
  }

  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }

  b.count++
  return { ok: true, retryAfterSec: 0 }
}

/** 从请求头解析客户端 IP：反代后取 x-forwarded-for 首段，回退 x-real-ip，再回退 "unknown"。 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

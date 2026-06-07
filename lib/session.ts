// 无依赖的会话令牌工具：使用 Web Crypto 的 HMAC-SHA256 签名。
// 同时兼容 Node 与 Edge 运行时，因此可被 proxy.ts 与路由处理器共同引用。
// 注意：此文件不导入 next/headers，保持纯函数，避免在 proxy 中引入请求作用域依赖。

export const SESSION_COOKIE = "session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天（秒）

export interface SessionPayload {
  userId: string
  role: string
  email: string
  exp: number // 毫秒时间戳
}

const DEFAULT_INSECURE_SECRET = "dev-insecure-secret-change-in-production"
const SECRET = process.env.NEXTAUTH_SECRET || DEFAULT_INSECURE_SECRET

// 安全护栏：生产环境若仍在用公开默认密钥，会话可被任意伪造（冒充任意用户/管理员）。
// 大声告警但不抛出——抛出会连带 next build 失败（构建环境通常没有该变量）。
if (process.env.NODE_ENV === "production" && SECRET === DEFAULT_INSECURE_SECRET) {
  console.error(
    "⚠️ [安全] 生产环境未设置 NEXTAUTH_SECRET，正在使用公开默认密钥——会话可被伪造！请设置强随机的 NEXTAUTH_SECRET（如 `openssl rand -base64 32`）后重启。"
  )
}

const encoder = new TextEncoder()

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function bytesFromB64url(s: string): Uint8Array<ArrayBuffer> {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(norm)
  const buf = new ArrayBuffer(bin.length)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

/** 将会话载荷签名为 `payload.signature` 形式的紧凑令牌。 */
export async function encryptSession(
  payload: Omit<SessionPayload, "exp"> & { exp?: number }
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: payload.exp ?? Date.now() + SESSION_MAX_AGE * 1000,
  }
  const data = b64urlFromBytes(encoder.encode(JSON.stringify(full)))
  const key = await getKey()
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`
}

/** 校验签名与有效期，返回载荷；非法或过期返回 null。 */
export async function decryptSession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null
  const [data, sig] = token.split(".")
  if (!data || !sig) return null
  try {
    const key = await getKey()
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      bytesFromB64url(sig),
      encoder.encode(data)
    )
    if (!valid) return null
    const payload = JSON.parse(
      new TextDecoder().decode(bytesFromB64url(data))
    ) as SessionPayload
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

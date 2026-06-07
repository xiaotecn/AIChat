import crypto from "node:crypto"

// API Key 等敏感字段的「静态加密」工具：AES-256-GCM。
// - 密钥来源：ENCRYPTION_KEY（优先）或 NEXTAUTH_SECRET，经 SHA-256 派生为 32 字节。
// - 密文带 `enc:v1:` 前缀，便于识别版本并与「历史明文」共存（向后兼容）。
// - 仅在 Node 运行时使用（路由处理器 / 服务端工具），不要在 Edge(proxy) 引用。

const ENC_PREFIX = "enc:v1:"

const SECRET =
  process.env.ENCRYPTION_KEY ||
  process.env.NEXTAUTH_SECRET ||
  "dev-insecure-secret-change-in-production"

/** 由 SECRET 派生出 32 字节 AES 密钥。 */
function aesKey(): Buffer {
  return crypto.createHash("sha256").update(SECRET, "utf8").digest()
}

/** 是否为本工具产出的密文。 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENC_PREFIX)
}

/**
 * 加密明文，返回 `enc:v1:<base64(iv|tag|ciphertext)>`。
 * 对空值与「已加密值」幂等（直接返回入参），避免重复加密。
 */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return ""
  if (isEncrypted(plain)) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64")
}

/**
 * 解密。无 `enc:v1:` 前缀者视为历史明文，原样返回（向后兼容）。
 * 解密失败（如密钥已轮换）返回空串——「fail closed」，让调用方按「无可用 key」处理。
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return ""
  if (!isEncrypted(stored)) return stored // 历史明文
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64")
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const data = raw.subarray(28)
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  } catch {
    return ""
  }
}

/**
 * 打码：返回形如 `sk-••••last4` 的展示串，绝不泄露完整 key。
 * 入参可为密文或明文（内部会先解密）。无 key 返回空串。
 */
export function maskSecret(stored: string | null | undefined): string {
  const plain = decryptSecret(stored)
  if (!plain) return ""
  if (plain.length <= 8) return "••••"
  return `${plain.slice(0, 3)}••••${plain.slice(-4)}`
}

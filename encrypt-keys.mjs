// 一次性迁移：把库中「尚未加密」的 provider.apiKey 就地加密（AES-256-GCM）。
// 与 lib/crypto.ts 使用同一套密钥派生（ENCRYPTION_KEY||NEXTAUTH_SECRET 经 SHA-256）。
// PrismaClient 实例化时会自动加载 .env，因此能读到 ENCRYPTION_KEY。
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

const prisma = new PrismaClient()

const ENC_PREFIX = 'enc:v1:'
const SECRET =
  process.env.ENCRYPTION_KEY ||
  process.env.NEXTAUTH_SECRET ||
  'dev-insecure-secret-change-in-production'
const aesKey = () => crypto.createHash('sha256').update(SECRET, 'utf8').digest()

function encryptSecret(plain) {
  if (!plain) return ''
  if (plain.startsWith(ENC_PREFIX)) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64')
}

const providers = await prisma.aiProvider.findMany()
let migrated = 0
for (const p of providers) {
  if (p.apiKey && !p.apiKey.startsWith(ENC_PREFIX)) {
    await prisma.aiProvider.update({
      where: { id: p.id },
      data: { apiKey: encryptSecret(p.apiKey) },
    })
    migrated++
  }
}
console.log(`已加密 ${migrated} / ${providers.length} 个提供商的 API Key（其余已是密文）`)
await prisma.$disconnect()

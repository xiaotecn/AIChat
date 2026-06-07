// 安全加固冒烟：API Key 打码返回、加密落库、留空=保持、解密可用、test 用存储 key。
// 前提：dev server 已在 3000 端口运行（已加载新 .env）；DB 已 seed 且历史 key 已迁移加密。
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
const prisma = new PrismaClient()

const BASE = 'http://localhost:3000'

// 复刻 lib/crypto.ts 的解密，用于校验「落库密文能还原成原始 key」（同一套密钥派生）
const ENC_PREFIX = 'enc:v1:'
const SECRET = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'dev-insecure-secret-change-in-production'
const aesKey = () => crypto.createHash('sha256').update(SECRET, 'utf8').digest()
function decryptSecret(stored) {
  if (!stored) return ''
  if (!stored.startsWith(ENC_PREFIX)) return stored
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), data = raw.subarray(28)
    const d = crypto.createDecipheriv('aes-256-gcm', aesKey(), iv); d.setAuthTag(tag)
    return Buffer.concat([d.update(data), d.final()]).toString('utf8')
  } catch { return '' }
}

function makeJar() {
  let cookie = ''
  return {
    get value() { return cookie },
    capture(res) { const sc = res.headers.get('set-cookie'); if (sc) { const m = sc.match(/session=[^;]*/); if (m) cookie = m[0] } },
  }
}
async function req(path, { method = 'GET', body, jar } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  if (jar) jar.capture(res)
  const txt = await res.text()
  let data; try { data = JSON.parse(txt) } catch { data = txt.slice(0, 120) }
  return { status: res.status, data }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }
async function me(jar) { const r = await req('/api/auth/me', { jar }); return r.data?.data ?? null }
async function row() { return prisma.aiProvider.findUnique({ where: { id: 'openai' } }) }
async function waitForUsedTokens(jar, prev, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs; let last = prev
  while (Date.now() < deadline) { const u = await me(jar); if (u) { last = u.usedTokens; if (u.usedTokens > prev) return u.usedTokens } await sleep(120) }
  return last
}

const admin = makeJar()
const KEY = 'sk-realish-SECRET-9999'
const stamp = Date.now()

const run = async () => {
  console.log('=== 安全加固冒烟 ===')

  console.log('--- 0) 管理员登录（隐含验证新 NEXTAUTH_SECRET 签名可用）---')
  let r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
  check('管理员登录成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  if (!admin.value) { console.log('无法登录，终止'); await prisma.$disconnect(); process.exit(2) }

  console.log('--- 1) 写入真实 key ---')
  r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: KEY, baseUrl: 'http://127.0.0.1:9/v1' } })
  check('PATCH 写入 key 成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  console.log('--- 2) GET 接口应只返回打码 key ---')
  r = await req('/api/admin/providers', { jar: admin })
  const o = r.data?.data?.find((p) => p.id === 'openai')
  check('GET 返回 hasApiKey=true', o?.hasApiKey === true, JSON.stringify(o)?.slice(0, 120))
  check('GET 的 key 已打码（含 ••）', typeof o?.apiKey === 'string' && o.apiKey.includes('••'), `apiKey=${o?.apiKey}`)
  check('GET 的 key 保留后4位 9999', o?.apiKey?.endsWith('9999'), `apiKey=${o?.apiKey}`)
  check('GET 绝不返回完整明文 key', o?.apiKey !== KEY && !(o?.apiKey || '').includes('realish'), `apiKey=${o?.apiKey}`)

  console.log('--- 3) 落库应为密文，且可还原为原始 key ---')
  const stored = (await row()).apiKey
  check('库内为 enc:v1: 密文', stored.startsWith('enc:v1:'), stored.slice(0, 24))
  check('库内不是明文', stored !== KEY, stored.slice(0, 24))
  check('密文可解密回原始 key', decryptSecret(stored) === KEY, `decrypted=${decryptSecret(stored)}`)

  console.log('--- 4) 留空 / 空串 / 打码串 都应「保持原 key 不变」---')
  await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true } })
  check('不传 apiKey → 原 key 不变', (await row()).apiKey === stored, 'changed')
  await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: '' } })
  check('apiKey 空串 → 原 key 不变', (await row()).apiKey === stored, 'changed')
  await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: o.apiKey } })
  check('回传打码串 → 原 key 不变（不被打码覆盖）', (await row()).apiKey === stored, 'overwritten by mask')

  console.log('--- 5) 测试连接：仅凭 providerId 应能服务端取出存储 key ---')
  r = await req('/api/admin/providers/test', { method: 'POST', jar: admin, body: { providerId: 'openai', baseUrl: 'http://127.0.0.1:9/v1' } })
  check('test 拿到了 key（非「必需」错误）', r.data?.success === false && !String(r.data?.message).includes('必需'), JSON.stringify(r.data))
  check('test 因不可达地址返回网络错误', /网络|错误|fetch|ECONN/i.test(String(r.data?.message)), JSON.stringify(r.data))

  console.log('--- 6) 端到端：聊天经解密后的 key 走通并扣费 ---')
  const U = makeJar()
  await req('/api/auth/register', { method: 'POST', jar: U, body: { name: '安全冒烟', email: `smoke_sec_${stamp}@example.com`, password: 'pass123456' } })
  const t0 = (await me(U))?.usedTokens ?? 0
  await req('/api/chat/stream', { method: 'POST', jar: U, body: { message: '你好', model: 'gpt-4' } })
  const t1 = await waitForUsedTokens(U, t0)
  check('聊天经加密 provider 正常扣费（delta>0）', t1 - t0 > 0, `delta=${t1 - t0}`)

  console.log('--- 7) 清理：还原 OpenAI 为禁用 + 占位 key ---')
  r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: false, apiKey: 'sk-placeholder', baseUrl: 'https://api.openai.com/v1' } })
  check('还原成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  console.log(`\n==== 安全冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

run().catch(async (e) => { console.error('SMOKE_CRASH', e); await prisma.$disconnect(); process.exit(2) })

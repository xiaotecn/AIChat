// 周期重置冒烟：用 prisma 回拨 periodStart 模拟周期跨越，验证惰性重置。
// 前提：dev server 已在 3000 端口运行；DB 已 seed。A/B/C 用 free(daily)；
// D 节自建一个确定 monthly 的套餐来验证（线上 pro 的 resetCycle 可能被后台改过，不依赖之）。
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const BASE = 'http://localhost:3000'
const DAY = 24 * 60 * 60 * 1000

function makeJar() {
  let cookie = ''
  return {
    get value() { return cookie },
    capture(res) {
      const sc = res.headers.get('set-cookie')
      if (sc) { const m = sc.match(/session=[^;]*/); if (m) cookie = m[0] }
    },
  }
}

async function req(path, { method = 'GET', body, jar } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + path, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  if (jar) jar.capture(res)
  const txt = await res.text()
  let data
  try { data = JSON.parse(txt) } catch { data = txt.slice(0, 120) }
  return { status: res.status, data }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) }
}
async function me(jar) {
  const r = await req('/api/auth/me', { jar })
  return r.data?.data ?? null
}
async function set(userId, fields) {
  await prisma.user.update({ where: { id: userId }, data: fields })
}
async function waitFor(jar, pred, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  let u = null
  while (Date.now() < deadline) {
    u = await me(jar)
    if (u && pred(u)) return u
    await sleep(120)
  }
  return u
}

const stamp = Date.now()

const run = async () => {
  console.log('=== 周期重置冒烟 ===')

  const W = makeJar()
  const email = `smoke_reset_${stamp}@example.com`
  let r = await req('/api/auth/register', { method: 'POST', jar: W, body: { name: '重置冒烟', email, password: 'pass123456' } })
  const uid = r.data?.data?.id
  check('注册用户成功（默认 free/daily 套餐）', r.status === 200 && !!uid, JSON.stringify(r))

  console.log('--- A) daily 已到期：/me 读取时应清零 ---')
  await set(uid, { usedTokens: 40000, usedMessages: 80, periodStart: new Date(Date.now() - 3 * DAY) })
  let u = await me(W)
  check('到期后 usedTokens/usedMessages 归零', u?.usedTokens === 0 && u?.usedMessages === 0, JSON.stringify(u))

  console.log('--- B) daily 未到期：/me 读取时保持不变 ---')
  await set(uid, { usedTokens: 40000, usedMessages: 80, periodStart: new Date() })
  u = await me(W)
  check('未到期不重置（保持 40000/80）', u?.usedTokens === 40000 && u?.usedMessages === 80, JSON.stringify(u))

  console.log('--- C) daily 已到期 + 原本超额：聊天应解除拦截并按新周期计费 ---')
  // 把用量顶到超过 free 限额（50000 token / 100 消息），periodStart 回拨 3 天
  await set(uid, { usedTokens: 60000, usedMessages: 200, periodStart: new Date(Date.now() - 3 * DAY) })
  r = await req('/api/chat/stream', { method: 'POST', jar: W, body: { message: '你好', model: 'gpt-3.5-turbo' } })
  check('超额但已跨周期 → 聊天放行 (200，非 403)', r.status === 200, JSON.stringify(r).slice(0, 120))
  u = await waitFor(W, (x) => x.usedMessages === 1)
  check('重置后本次消息计为 1 条', u?.usedMessages === 1, JSON.stringify(u))
  check('重置后 usedTokens 为新周期的小额（<50000）', (u?.usedTokens ?? 1e9) > 0 && u.usedTokens < 50000, JSON.stringify(u))

  console.log('--- D) monthly：用专设 monthly 套餐验证按月重置 ---')
  // 线上 pro 的 resetCycle 可能被管理员改成 daily（与种子的 monthly 不一致），故自建一个确定 monthly 的套餐，测完即删。
  const monthlyPlanId = `smoke_monthly_${stamp}`
  await prisma.plan.create({ data: { id: monthlyPlanId, name: '冒烟月度套餐', description: '周期重置冒烟专用', tokenLimit: 2000000, messageLimit: 1000, price: 0, resetCycle: 'monthly', enabled: true } })
  // D1：跨月（40 天）→ 清零
  await set(uid, { planId: monthlyPlanId, usedTokens: 100000, usedMessages: 500, periodStart: new Date(Date.now() - 40 * DAY) })
  u = await me(W)
  check('monthly 跨月 → 清零', u?.usedTokens === 0 && u?.usedMessages === 0, JSON.stringify(u))
  // D2：本月内（10 天）→ 不动
  await set(uid, { usedTokens: 12345, usedMessages: 50, periodStart: new Date(Date.now() - 10 * DAY) })
  u = await me(W)
  check('monthly 本月内 → 不重置（保持 12345/50）', u?.usedTokens === 12345 && u?.usedMessages === 50, JSON.stringify(u))
  // 清理：先把用户移回 free 解除外键引用，再删除专设套餐
  await set(uid, { planId: 'free' })
  await prisma.plan.delete({ where: { id: monthlyPlanId } }).catch(() => {})

  console.log(`\n==== 周期重置冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

run().catch(async (e) => { console.error('SMOKE_CRASH', e); await prisma.$disconnect(); process.exit(2) })

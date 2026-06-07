// 订阅开通时间 / 过期回默认 / 重置额度 冒烟。沿用 cookie jar 范式。
// 覆盖：①设套餐+未来到期(不过期) ②设过期→后台列表加载触发清扫回默认 ③设过期→用户 /me 触发惰性回退 ④重置额度。
const BASE = 'http://localhost:3000'

function makeJar() {
  let cookie = ''
  return { get value() { return cookie }, capture(res) { const sc = res.headers.get('set-cookie'); if (sc) { const m = sc.match(/session=[^;]*/); if (m) cookie = m[0] } } }
}
async function req(path, { method = 'GET', body, jar } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  if (jar) jar.capture(res)
  const txt = await res.text(); let data; try { data = JSON.parse(txt) } catch { data = txt.slice(0, 200) }
  return { status: res.status, data }
}
// 触发一次聊天以累计用量（无启用提供商时走 mock，仍会 bumpUserUsage）
async function chat(jar, message) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + '/api/chat/stream', { method: 'POST', headers, body: JSON.stringify({ model: 'gpt-3.5-turbo', message }) })
  await res.text()
  return res.status
}
let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }

const admin = makeJar(), u = makeJar()
const email = `smoke_sub_${Date.now()}@example.com`
let uid = ''
let origDefaultPlanId = null

async function findUser() {
  const r = await req('/api/admin/users', { jar: admin })
  return (r.data?.data || []).find((x) => x.email === email)
}

const run = async () => {
  console.log('=== 订阅过期 / 重置额度 冒烟 ===')

  let r = await req('/api/auth/register', { method: 'POST', jar: u, body: { name: '订阅测试', email, password: 'pass123456' } })
  check('注册测试用户并登录', r.status === 200 && r.data?.success && !!u.value, JSON.stringify(r).slice(0, 160))

  r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
  check('管理员登录', r.status === 200 && r.data?.success, JSON.stringify(r))

  const found = await findUser()
  uid = found?.id
  check('取到测试用户 id', !!uid, '未找到')

  // 设默认套餐为 free，作为过期回退目标（保存原值以便还原）
  r = await req('/api/admin/settings', { jar: admin })
  origDefaultPlanId = r.data?.data?.settings?.defaultPlanId ?? null
  r = await req('/api/admin/settings', { method: 'PATCH', jar: admin, body: { defaultPlanId: 'free' } })
  check('设默认套餐=free', r.data?.success === true && r.data?.data?.defaultPlanId === 'free', JSON.stringify(r.data))

  console.log('--- 1) 开通 pro + 未来到期：不过期 ---')
  const future = new Date(Date.now() + 7 * 86400000).toISOString()
  r = await req(`/api/admin/users/${uid}`, { method: 'PATCH', jar: admin, body: { planId: 'pro', expiresAt: future } })
  check('PATCH 开通 pro + 未来到期', r.data?.success === true, JSON.stringify(r))
  let user = await findUser()
  check('列表显示 pro 且有到期时间', user?.planId === 'pro' && !!user?.expiresAt, JSON.stringify(user))
  r = await req('/api/auth/me', { jar: u })
  check('用户 /me 未过期仍是 pro', r.data?.data?.planId === 'pro', JSON.stringify(r.data?.data))

  console.log('--- 2) 设为已过期：后台列表加载触发清扫回默认 ---')
  const past = new Date(Date.now() - 60000).toISOString()
  r = await req(`/api/admin/users/${uid}`, { method: 'PATCH', jar: admin, body: { planId: 'pro', expiresAt: past } })
  check('PATCH 设过去到期时间', r.data?.success === true, JSON.stringify(r))
  user = await findUser() // 这次 GET 会先 sweepExpiredSubscriptions
  check('清扫后回退到默认套餐 free', user?.planId === 'free', JSON.stringify(user))
  check('清扫后到期时间被清空', !user?.expiresAt, `expiresAt=${user?.expiresAt}`)

  console.log('--- 3) 再次设过期：用户 /me 触发惰性回退 ---')
  r = await req(`/api/admin/users/${uid}`, { method: 'PATCH', jar: admin, body: { planId: 'pro', expiresAt: past } })
  check('PATCH 重新设为过期的 pro', r.data?.success === true, JSON.stringify(r))
  r = await req('/api/auth/me', { jar: u })
  check('用户 /me 惰性回退到 free', r.data?.data?.planId === 'free', JSON.stringify(r.data?.data))
  check('惰性回退后到期时间为空', !r.data?.data?.expiresAt, `expiresAt=${r.data?.data?.expiresAt}`)

  console.log('--- 4) 重置额度 ---')
  await chat(u, '累计一次用量') // 走 mock，bumpUserUsage 使 usedMessages +1
  // bumpUserUsage 在流关闭后异步执行，轮询等待落库
  let before = null
  for (let i = 0; i < 8; i++) {
    user = await findUser()
    if ((user?.usedMessages || 0) > 0) { before = user; break }
    await new Promise((r) => setTimeout(r, 250))
  }
  check('聊天后已用消息 > 0', (before?.usedMessages || 0) > 0, `usedMessages=${before?.usedMessages}`)
  r = await req(`/api/admin/users/${uid}/reset-usage`, { method: 'POST', jar: admin })
  check('重置额度接口成功', r.data?.success === true, JSON.stringify(r))
  user = await findUser()
  check('重置后已用消息归零', (user?.usedMessages || 0) === 0, `usedMessages=${user?.usedMessages}`)
  check('重置后已用 token 归零', (user?.usedTokens || 0) === 0, `usedTokens=${user?.usedTokens}`)

  console.log('--- 清理 ---')
  if (uid) await req(`/api/admin/users/${uid}`, { method: 'DELETE', jar: admin })
  await req('/api/admin/settings', { method: 'PATCH', jar: admin, body: { defaultPlanId: origDefaultPlanId || '' } })
  check('还原默认套餐设置', true, '')

  console.log(`\n==== 订阅过期冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  await new Promise((r) => setTimeout(r, 500))
  process.exit(fail === 0 ? 0 : 1)
}
run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

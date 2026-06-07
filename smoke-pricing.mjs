// 定价冒烟：验证「模型价格加权扣额度 / 超额拦截 / 后台改价」三件事。
// 前提：dev server 已在 3000 端口运行，且数据库已 seed（providers 默认禁用、价格 1/10/3）。
const BASE = 'http://localhost:3000'

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
  const txt = await res.text() // 对流式响应而言，等待 text() 即等待整个流读完
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

// 扣额度发生在流 close() 之后的异步写库里，轮询直到 usedTokens 超过 prev（或超时）
async function waitForUsedTokens(jar, prev, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  let last = prev
  while (Date.now() < deadline) {
    const u = await me(jar)
    if (u) { last = u.usedTokens; if (u.usedTokens > prev) return u.usedTokens }
    await sleep(120)
  }
  return last
}

const admin = makeJar()
const stamp = Date.now()

const run = async () => {
  console.log('=== 定价冒烟 ===')

  console.log('--- 0) 管理员登录 ---')
  let r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
  check('管理员登录成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  if (!admin.value) { console.log('无法登录管理员，终止'); process.exit(2) }

  // 启用 OpenAI 提供商，给一个「可用」(不含 placeholder) 的 key，
  // 并把 baseUrl 指向必定快速失败的本地端口 —— 这样 resolveChatProvider 走分支1
  // 返回模型真实 price，随后真实请求失败回退到 mock，但 price 仍被保留用于扣额度。
  console.log('--- 1) 启用 OpenAI 提供商（可用key + 快速失败URL）---')
  r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: 'sk-smoke-usable-key', baseUrl: 'http://127.0.0.1:9/v1' } })
  check('启用 OpenAI 成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  // 读取模型 id
  r = await req('/api/admin/providers', { jar: admin })
  const providers = Array.isArray(r.data?.data) ? r.data.data : []
  const openai = providers.find((p) => p.id === 'openai')
  const anthropic = providers.find((p) => p.id === 'anthropic')
  const gpt35 = openai?.models?.find((m) => m.code === 'gpt-3.5-turbo')
  const gpt4 = openai?.models?.find((m) => m.code === 'gpt-4')
  const claude = anthropic?.models?.find((m) => m.code === 'claude-3-sonnet')
  check('读到 gpt-3.5/gpt-4/claude 模型', !!gpt35 && !!gpt4 && !!claude, JSON.stringify({ gpt35, gpt4, claude }).slice(0, 200))
  check('种子价格 gpt-3.5=1 / gpt-4=10', gpt35?.price === 1 && gpt4?.price === 10, `gpt35=${gpt35?.price} gpt4=${gpt4?.price}`)

  console.log('--- 2) 后台修改模型价格（claude 3 -> 7 -> 3）---')
  r = await req(`/api/admin/models/${claude.id}`, { method: 'PATCH', jar: admin, body: { price: 7 } })
  check('PATCH 改价返回成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  r = await req('/api/admin/providers', { jar: admin })
  const claudeAfter = r.data?.data?.find((p) => p.id === 'anthropic')?.models?.find((m) => m.code === 'claude-3-sonnet')
  check('改价已落库 (price=7)', claudeAfter?.price === 7, `price=${claudeAfter?.price}`)
  // 还原
  await req(`/api/admin/models/${claude.id}`, { method: 'PATCH', jar: admin, body: { price: 3 } })

  console.log('--- 3) 价格加权扣额度：同一消息分别用 gpt-3.5(×1) 与 gpt-4(×10) ---')
  const user = makeJar()
  const email = `smoke_price_${stamp}@example.com`
  r = await req('/api/auth/register', { method: 'POST', jar: user, body: { name: '定价冒烟', email, password: 'pass123456' } })
  check('注册定价用户成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  const MSG = '请用一句话介绍你自己。'
  const u0 = await me(user)
  const t0 = u0?.usedTokens ?? 0
  check('初始 usedTokens 为 0', t0 === 0, `t0=${t0}`)

  await req('/api/chat/stream', { method: 'POST', jar: user, body: { message: MSG, model: 'gpt-3.5-turbo' } })
  const t1 = await waitForUsedTokens(user, t0)
  const d1 = t1 - t0
  check('gpt-3.5 扣减了额度 (delta1>0)', d1 > 0, `d1=${d1}`)

  await req('/api/chat/stream', { method: 'POST', jar: user, body: { message: MSG, model: 'gpt-4' } })
  const t2 = await waitForUsedTokens(user, t1)
  const d2 = t2 - t1
  check('gpt-4 扣减了额度 (delta2>0)', d2 > 0, `d2=${d2}`)
  // 价格 10 vs 1，回复模板近似等长，delta2 应约为 delta1 的 10 倍
  check('gpt-4 按 10 倍价格扣额度 (6×<delta2<15×)', d2 > d1 * 6 && d2 < d1 * 15, `d1=${d1} d2=${d2} ratio=${(d2 / d1).toFixed(2)}`)
  check('usedMessages 累加为 2', (await me(user))?.usedMessages === 2, `usedMessages=${(await me(user))?.usedMessages}`)

  console.log('--- 4) 超额拦截：分配 messageLimit=0 的套餐后聊天应 403 ---')
  r = await req('/api/admin/plans', { method: 'POST', jar: admin, body: { name: `冒烟零额度_${stamp}`, description: '测试用', tokenLimit: 0, messageLimit: 0, price: 0, resetCycle: 'daily', enabled: true } })
  const zeroPlanId = r.data?.data?.id
  check('创建零额度套餐成功', r.status === 200 && !!zeroPlanId, JSON.stringify(r))

  const userC = makeJar()
  const emailC = `smoke_limit_${stamp}@example.com`
  await req('/api/auth/register', { method: 'POST', jar: userC, body: { name: '超额冒烟', email: emailC, password: 'pass123456' } })
  // 找到 userC 的 id 并改套餐
  r = await req('/api/admin/users', { jar: admin })
  const cRecord = r.data?.data?.find((u) => u.email === emailC)
  check('管理员可查到新用户', !!cRecord?.id, emailC)
  r = await req(`/api/admin/users/${cRecord.id}`, { method: 'PATCH', jar: admin, body: { planId: zeroPlanId } })
  check('改为零额度套餐成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  r = await req('/api/chat/stream', { method: 'POST', jar: userC, body: { message: '你好', model: 'gpt-3.5-turbo' } })
  check('超额用户聊天被拦截 (403)', r.status === 403, JSON.stringify(r))
  const cAfter = await me(userC)
  check('被拦截后未扣额度 (usedTokens=0, usedMessages=0)', (cAfter?.usedTokens ?? -1) === 0 && (cAfter?.usedMessages ?? -1) === 0, JSON.stringify(cAfter))

  console.log('--- 5) 清理：还原 OpenAI 提供商为禁用 + 占位 key ---')
  r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: false, apiKey: 'sk-placeholder', baseUrl: 'https://api.openai.com/v1' } })
  check('还原 OpenAI 提供商成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  console.log(`\n==== 定价冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

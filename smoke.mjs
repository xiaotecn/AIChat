// HTTP smoke test for the restored auth + DB-backed chat flow.
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
  const txt = await res.text()
  let data
  try { data = JSON.parse(txt) } catch { data = txt.slice(0, 100) }
  return { status: res.status, data }
}

let pass = 0, fail = 0
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) }
}

const u1 = makeJar(), u2 = makeJar(), admin = makeJar()
const email1 = `smoke_${Date.now()}_a@example.com`
const email2 = `smoke_${Date.now()}_b@example.com`

const run = async () => {
  console.log('--- 1) 注册用户A ---')
  let r = await req('/api/auth/register', { method: 'POST', jar: u1, body: { name: '冒烟A', email: email1, password: 'pass123456' } })
  check('register A 成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  check('register A 下发 session cookie', !!u1.value, 'no cookie')

  console.log('--- 2) /api/auth/me 读取登录态 ---')
  r = await req('/api/auth/me', { jar: u1 })
  check('me 返回当前用户', r.status === 200 && r.data?.data?.email === email1, JSON.stringify(r))

  console.log('--- 3) 未登录访问 me 应 401 ---')
  r = await req('/api/auth/me')
  check('未登录 me = 401', r.status === 401, JSON.stringify(r))

  console.log('--- 4) 创建会话 ---')
  r = await req('/api/conversations', { method: 'POST', jar: u1, body: { title: '冒烟会话', modelId: 'gpt-3.5-turbo' } })
  const convId = r.data?.data?.id
  check('创建会话成功', r.status === 200 && !!convId, JSON.stringify(r))

  console.log('--- 5) 写入消息 ---')
  r = await req('/api/messages', { method: 'POST', jar: u1, body: { conversationId: convId, role: 'user', content: '你好，这是一条测试消息' } })
  check('写入消息成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  console.log('--- 6) 列出会话(应含刚建的) ---')
  r = await req('/api/conversations', { jar: u1 })
  check('会话列表含新会话', r.status === 200 && Array.isArray(r.data?.data) && r.data.data.some(c => c.id === convId), JSON.stringify(r).slice(0, 200))

  console.log('--- 7) 读取该会话消息 ---')
  r = await req(`/api/messages?conversationId=${convId}`, { jar: u1 })
  check('消息已落库可读', r.status === 200 && Array.isArray(r.data?.data) && r.data.data.length >= 1, JSON.stringify(r).slice(0, 200))

  console.log('--- 8) 重命名会话 (PATCH [id]) ---')
  r = await req(`/api/conversations/${convId}`, { method: 'PATCH', jar: u1, body: { title: '改名后的会话' } })
  check('重命名成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  console.log('--- 9) 归属校验:用户B 注册并尝试读 A 的消息 ---')
  await req('/api/auth/register', { method: 'POST', jar: u2, body: { name: '冒烟B', email: email2, password: 'pass123456' } })
  r = await req(`/api/messages?conversationId=${convId}`, { jar: u2 })
  check('用户B 读不到A的消息(403或空)', r.status === 403 || (r.status === 200 && (r.data?.data?.length ?? 0) === 0), JSON.stringify(r).slice(0, 200))
  r = await req(`/api/conversations/${convId}`, { method: 'PATCH', jar: u2, body: { title: '恶意改名' } })
  check('用户B 改不了A的会话', r.status === 403 || r.status === 404, JSON.stringify(r))

  console.log('--- 10) 删除会话 ---')
  r = await req(`/api/conversations/${convId}`, { method: 'DELETE', jar: u1 })
  check('删除成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  r = await req(`/api/messages?conversationId=${convId}`, { jar: u1 })
  check('删除后读不到消息', r.status === 200 ? (r.data?.data?.length ?? 0) === 0 : (r.status === 403 || r.status === 404), JSON.stringify(r).slice(0, 120))

  console.log('--- 11) admin 保护:无 session 访问 /api/admin/users ---')
  r = await req('/api/admin/users')
  check('未登录访问 admin = 401/403/3xx', [401, 403, 302, 307, 308].includes(r.status), JSON.stringify(r).slice(0, 120))

  console.log('--- 12) 普通用户访问 admin 应被拒 ---')
  r = await req('/api/admin/users', { jar: u1 })
  check('普通用户访问 admin = 401/403/3xx', [401, 403, 302, 307, 308].includes(r.status), JSON.stringify(r).slice(0, 120))

  console.log('--- 13) 管理员登录并访问 admin ---')
  r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
  check('管理员登录成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  r = await req('/api/admin/users', { jar: admin })
  check('管理员可访问 admin 用户接口', r.status === 200, JSON.stringify(r).slice(0, 120))

  console.log(`\n==== 冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch(e => { console.error('SMOKE_CRASH', e); process.exit(2) })

// 消息删除接口冒烟（重新生成依赖它清理旧回复）。前提：dev server 运行中。
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
  const txt = await res.text(); let data; try { data = JSON.parse(txt) } catch { data = txt.slice(0, 120) }
  return { status: res.status, data }
}
let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }

const stamp = Date.now()
const run = async () => {
  console.log('=== 消息删除冒烟 ===')
  const u1 = makeJar(), u2 = makeJar()
  await req('/api/auth/register', { method: 'POST', jar: u1, body: { name: '删消息A', email: `smoke_msg_${stamp}_a@example.com`, password: 'pass123456' } })
  await req('/api/auth/register', { method: 'POST', jar: u2, body: { name: '删消息B', email: `smoke_msg_${stamp}_b@example.com`, password: 'pass123456' } })

  let r = await req('/api/conversations', { method: 'POST', jar: u1, body: { title: '删消息会话', modelId: 'gpt-3.5-turbo' } })
  const convId = r.data?.data?.id
  check('创建会话成功', !!convId, JSON.stringify(r))

  r = await req('/api/messages', { method: 'POST', jar: u1, body: { conversationId: convId, role: 'assistant', content: '待删除的回复' } })
  const msgId = r.data?.data?.id
  check('写入消息成功并拿到 id', !!msgId, JSON.stringify(r))

  r = await req(`/api/messages?conversationId=${convId}`, { jar: u1 })
  check('删除前消息存在', Array.isArray(r.data?.data) && r.data.data.some((m) => m.id === msgId), JSON.stringify(r).slice(0, 160))

  r = await req(`/api/messages/${msgId}`, { method: 'DELETE', jar: u2 })
  check('他人不能删除（403）', r.status === 403, JSON.stringify(r))

  r = await req(`/api/messages/${msgId}`, { method: 'DELETE', jar: u1 })
  check('本人删除成功', r.status === 200 && r.data?.success, JSON.stringify(r))

  r = await req(`/api/messages?conversationId=${convId}`, { jar: u1 })
  check('删除后消息消失', Array.isArray(r.data?.data) && !r.data.data.some((m) => m.id === msgId), JSON.stringify(r).slice(0, 160))

  r = await req(`/api/messages/${msgId}`, { method: 'DELETE', jar: u1 })
  check('重复删除返回 404', r.status === 404, JSON.stringify(r))

  console.log(`\n==== 消息删除冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  process.exit(fail === 0 ? 0 : 1)
}
run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

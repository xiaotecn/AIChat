// 流式 + 中止 行为冒烟：验证 /api/chat/stream 是「增量逐块」返回，且客户端 abort 干净。
// 这是「流式可见」与「停止生成」两个 UI 特性背后的服务端行为。前提：dev server 运行中。
const BASE = 'http://localhost:3000'
function makeJar() {
  let cookie = ''
  return { get value() { return cookie }, capture(res) { const sc = res.headers.get('set-cookie'); if (sc) { const m = sc.match(/session=[^;]*/); if (m) cookie = m[0] } } }
}
let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }

const stamp = Date.now()
const run = async () => {
  console.log('=== 流式 / 中止 冒烟 ===')
  const jar = makeJar()
  // 注册拿 cookie
  const reg = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '流式冒烟', email: `smoke_stream_${stamp}@example.com`, password: 'pass123456' }),
  })
  jar.capture(reg)
  check('注册并拿到 cookie', !!jar.value, 'no cookie')

  // 发起流式请求，读到若干增量后中止
  const ac = new AbortController()
  let contentChunks = 0
  let total = ''
  let aborted = false
  try {
    const res = await fetch(BASE + '/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: jar.value },
      body: JSON.stringify({ message: '给我讲一段较长的话用于观察流式输出', model: 'gpt-3.5-turbo' }),
      signal: ac.signal,
    })
    check('流式响应 200', res.status === 200, String(res.status))
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const piece = dec.decode(value, { stream: true })
      if (piece) { contentChunks++; total += piece }
      if (contentChunks >= 6) { ac.abort(); }  // 模拟用户点「停止」
    }
  } catch (e) {
    if (e && e.name === 'AbortError') aborted = true
    else throw e
  }

  check('内容是增量逐块到达（≥3 块）', contentChunks >= 3, `chunks=${contentChunks}`)
  check('中止前已收到部分内容', total.length > 0, `len=${total.length}`)
  check('客户端 abort 触发 AbortError（停止干净）', aborted, `aborted=${aborted}`)

  // 中止后服务端仍存活：再发一个普通请求应正常
  const ping = await fetch(BASE + '/api/auth/me', { headers: { Cookie: jar.value } })
  check('中止后服务端仍正常响应', ping.status === 200, String(ping.status))

  console.log(`\n==== 流式/中止 冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  process.exit(fail === 0 ? 0 : 1)
}
run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

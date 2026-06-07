// 「测试连接」流程冒烟：本地起一个假上游，验证 list-models 拉取模型、
// test 用选中模型成功、test 不传模型时服务端自动探测首个真实模型（不再写死）。
import http from 'node:http'
const BASE = 'http://localhost:3000'
const PORT = 4123

function makeJar() {
  let cookie = ''
  return { get value() { return cookie }, capture(res) { const sc = res.headers.get('set-cookie'); if (sc) { const m = sc.match(/session=[^;]*/); if (m) cookie = m[0] } } }
}
async function req(path, { method = 'GET', body, jar } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  if (jar) jar.capture(res)
  const txt = await res.text(); let data; try { data = JSON.parse(txt) } catch { data = txt.slice(0, 160) }
  return { status: res.status, data }
}
let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }

// 假 OpenAI 兼容上游：/v1/models 返回两个模型；/v1/chat/completions 回显所用模型
function startUpstream() {
  return new Promise((resolve) => {
    const server = http.createServer((requ, res) => {
      if (requ.url.endsWith('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'fake-model-a' }, { id: 'fake-model-b' }] }))
      } else if (requ.url.endsWith('/chat/completions')) {
        let b = ''
        requ.on('data', (c) => (b += c))
        requ.on('end', () => {
          let m = ''
          try { m = JSON.parse(b).model } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ choices: [{ message: { content: `echo:${m}` } }] }))
        })
      } else {
        res.writeHead(404); res.end('{}')
      }
    })
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

const admin = makeJar()
const run = async () => {
  console.log('=== 测试连接流程冒烟 ===')
  const upstream = await startUpstream()
  const baseUrl = `http://127.0.0.1:${PORT}/v1`
  try {
    let r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
    check('管理员登录', r.status === 200 && r.data?.success, JSON.stringify(r))

    r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: 'sk-fake-usable-key', baseUrl } })
    check('指向假上游', r.status === 200 && r.data?.success, JSON.stringify(r))

    console.log('--- 1) list-models 拉取可用模型 ---')
    r = await req('/api/admin/providers/list-models', { method: 'POST', jar: admin, body: { providerId: 'openai' } })
    check('list-models 成功', r.data?.success === true, JSON.stringify(r))
    check('返回 fake-model-a / fake-model-b', Array.isArray(r.data?.models) && r.data.models.includes('fake-model-a') && r.data.models.includes('fake-model-b'), JSON.stringify(r.data))

    console.log('--- 2) 用选中模型测试连接 ---')
    r = await req('/api/admin/providers/test', { method: 'POST', jar: admin, body: { providerId: 'openai', model: 'fake-model-b' } })
    check('测试连接成功', r.data?.success === true, JSON.stringify(r.data))
    check('确实用了选中的 fake-model-b', String(r.data?.response).includes('fake-model-b'), JSON.stringify(r.data))

    console.log('--- 3) 不传模型 → 服务端自动探测首个真实模型（非写死）---')
    r = await req('/api/admin/providers/test', { method: 'POST', jar: admin, body: { providerId: 'openai' } })
    check('自动探测后测试成功', r.data?.success === true, JSON.stringify(r.data))
    check('用的是探测到的 fake-model-a 而非写死 gpt-3.5-turbo', String(r.data?.response).includes('fake-model-a') && !String(r.data?.response).includes('gpt-3.5-turbo'), JSON.stringify(r.data))

    console.log('--- 4) 清理：还原 OpenAI ---')
    r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: false, apiKey: 'sk-placeholder', baseUrl: 'https://api.openai.com/v1' } })
    check('还原成功', r.status === 200 && r.data?.success, JSON.stringify(r))
  } finally {
    // 等 close 回调完成再退出，避免 Windows libuv 在句柄关闭中途 process.exit 触发断言
    await new Promise((resolve) => upstream.close(resolve))
  }

  console.log(`\n==== 测试连接冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  // 退出前留一个短 drain，让 Node/undici 的异步句柄完成关闭，规避 Windows 上 process.exit 触发 libuv 断言
  await new Promise((r) => setTimeout(r, 500))
  process.exit(fail === 0 ? 0 : 1)
}
run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

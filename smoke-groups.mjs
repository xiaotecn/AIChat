// 模型分组功能冒烟：CRUD / 轮询 / 故障转移 / 关键词预设 / 套餐门控 / 向后兼容 / 额度 / 延迟。
// 复用 smoke-test-conn.mjs 的「进程内假上游 + cookie jar」范式。
// 假上游对 /chat/completions 以 SSE 回显所用模型（echo:<model>），可按 failModel 对指定模型返 500。
import http from 'node:http'
const BASE = 'http://localhost:3000'
const PORT = 4137

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
// 聊天流式响应返回 text/plain，需读取完整文本（不截断、不当 JSON 解析）
async function chat(jar, model, message) {
  const headers = { 'Content-Type': 'application/json' }
  if (jar && jar.value) headers['Cookie'] = jar.value
  const res = await fetch(BASE + '/api/chat/stream', { method: 'POST', headers, body: JSON.stringify({ model, message }) })
  return { status: res.status, text: await res.text() }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
function check(name, cond, detail) { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name} -> ${detail}`) } }

// 进程内假上游：可变 failModel（对该模型返 500）与 chatHits（/chat/completions 命中计数）
let chatHits = 0
let imageHits = 0
let failModel = null
function startUpstream() {
  return new Promise((resolve) => {
    const server = http.createServer((requ, res) => {
      if (requ.url.endsWith('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'gpt-3.5-turbo' }, { id: 'gpt-4' }] }))
      } else if (requ.url.endsWith('/chat/completions')) {
        let b = ''
        requ.on('data', (c) => (b += c))
        requ.on('end', () => {
          chatHits++
          let model = ''
          try { model = JSON.parse(b).model } catch {}
          if (failModel && model === failModel) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'simulated failure' }))
            return
          }
          res.writeHead(200, { 'Content-Type': 'text/event-stream' })
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `echo:${model}` } }] })}\n\n`)
          res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { total_tokens: 7 } })}\n\n`)
          res.write('data: [DONE]\n\n')
          res.end()
        })
      } else if (requ.url.endsWith('/images/generations')) {
        // 生图：消费请求体后返回一张固定图片 url（计 imageHits，不计 chatHits）
        let b = ''
        requ.on('data', (c) => (b += c))
        requ.on('end', () => {
          imageHits++
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${PORT}/img.png` }] }))
        })
      } else { res.writeHead(404); res.end('{}') }
    })
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

const admin = makeJar(), gate = makeJar()
const baseUrl = `http://127.0.0.1:${PORT}/v1`
const GRP = `smoke-grp-${Date.now()}`
const gateEmail = `smoke_gate_${Date.now()}@example.com`
let grpId = ''
let proOnlyId = ''
let gateUserId = ''
let proOriginalGroupIds = []

const run = async () => {
  console.log('=== 模型分组功能冒烟 ===')
  const upstream = await startUpstream()
  try {
    let r = await req('/api/auth/login', { method: 'POST', jar: admin, body: { email: 'admin@example.com', password: 'admin123456' } })
    check('管理员登录', r.status === 200 && r.data?.success, JSON.stringify(r))

    // 让 openai 提供商指向假上游并启用（其下 gpt-3.5-turbo / gpt-4 即变为可用）
    r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: true, apiKey: 'sk-fake-usable-key', baseUrl } })
    check('openai 指向假上游并启用', r.status === 200 && r.data?.success, JSON.stringify(r))

    // 取模型 DB id
    r = await req('/api/admin/models', { jar: admin })
    const models = r.data?.data || []
    const gpt35 = models.find((m) => m.code === 'gpt-3.5-turbo')
    const gpt4 = models.find((m) => m.code === 'gpt-4')
    check('GET /api/admin/models 带 id', !!gpt35?.id && !!gpt4?.id, JSON.stringify(models).slice(0, 200))

    console.log('--- 1) 管理员 CRUD：建组 + PUT 两成员 ---')
    r = await req('/api/admin/model-groups', { method: 'POST', jar: admin, body: { name: GRP } })
    grpId = r.data?.data?.id
    check('建组成功', r.status === 200 && !!grpId, JSON.stringify(r))
    r = await req(`/api/admin/model-groups/${grpId}/models`, { method: 'PUT', jar: admin, body: { modelIds: [gpt35.id, gpt4.id] } })
    check('PUT 两个成员', r.data?.success === true && r.data?.count === 2, JSON.stringify(r))
    r = await req('/api/admin/model-groups', { jar: admin })
    const mine = (r.data?.data || []).find((g) => g.id === grpId)
    check('GET 列表显示 2 个成员', mine?.members?.length === 2, JSON.stringify(mine))

    console.log('--- 2) 轮询：连发多次，回显模型应在成员间轮转 ---')
    failModel = null
    const echoes = []
    for (let i = 0; i < 4; i++) {
      const c = await chat(admin, grpId, `hello ${i}`)
      const m = (c.text.match(/echo:(\S+)/) || [])[1] || ''
      echoes.push(m)
      await sleep(150) // 让 fire-and-forget 的 cursor 自增落库
    }
    check('轮询命中两个不同模型（round-robin）', echoes.includes('gpt-3.5-turbo') && echoes.includes('gpt-4'), JSON.stringify(echoes))

    console.log('--- 8) 延迟：轮询后成员 avgLatencyMs 应非空 ---')
    let latencyOk = false
    for (let i = 0; i < 6; i++) {
      r = await req('/api/admin/model-groups', { jar: admin })
      const g = (r.data?.data || []).find((x) => x.id === grpId)
      if (g && g.members.some((m) => (m.avgLatencyMs || 0) > 0)) { latencyOk = true; break }
      await sleep(300)
    }
    check('成员 avgLatencyMs 已记录(>0)', latencyOk, '所有成员延迟仍为空')

    console.log('--- 3) 故障转移：gpt-3.5-turbo 返 500，应转移到 gpt-4 ---')
    failModel = 'gpt-3.5-turbo'
    let allGpt4 = true
    for (let i = 0; i < 2; i++) {
      const c = await chat(admin, grpId, `failover ${i}`)
      if (!c.text.includes('echo:gpt-4')) allGpt4 = false
      await sleep(150)
    }
    check('故障转移后内容均来自 gpt-4', allGpt4, '存在未转移到 gpt-4 的响应')
    failModel = null

    console.log('--- 4)+7) 关键词预设 + 额度计数 ---')
    r = await req(`/api/admin/model-groups/${grpId}/rules`, { method: 'PUT', jar: admin, body: { rules: [{ keyword: 'ping', matchType: 'contains', reply: 'pong', enabled: true }] } })
    check('PUT 关键词规则', r.data?.success === true && r.data?.count === 1, JSON.stringify(r))
    let me = await req('/api/auth/me', { jar: admin })
    const msgBefore = me.data?.data?.usedMessages ?? 0
    const hitsBefore = chatHits
    const ck = await chat(admin, grpId, 'ping please')
    check('关键词命中返回 pong', ck.text === 'pong', JSON.stringify(ck))
    check('关键词命中未调用上游(chatHits 不变)', chatHits === hitsBefore, `before=${hitsBefore} after=${chatHits}`)
    me = await req('/api/auth/me', { jar: admin })
    let msgAfter = me.data?.data?.usedMessages ?? 0
    // 预设回复在流关闭后异步扣额度，轮询等待其落库
    for (let i = 0; i < 8 && msgAfter < msgBefore + 1; i++) {
      await sleep(200)
      me = await req('/api/auth/me', { jar: admin })
      msgAfter = me.data?.data?.usedMessages ?? 0
    }
    check('关键词命中计 1 条消息', msgAfter === msgBefore + 1, `before=${msgBefore} after=${msgAfter}`)

    console.log('--- 6) 向后兼容：模型码走旧路 / 分组 id 走分组路 ---')
    const byCode = await chat(admin, 'gpt-3.5-turbo', 'hi by code')
    check('模型码 gpt-3.5-turbo 仍可用(旧路)', byCode.text.includes('echo:gpt-3.5-turbo'), JSON.stringify(byCode).slice(0, 160))
    // 用本冒烟自建的分组（成员指向假上游）验证「分组 id 走分组路」，
    // 不依赖种子 default 分组——其成员可能被管理员在后台改成真实模型/真实上游。
    const byGroup = await chat(admin, grpId, 'hi by group')
    check('分组 id 走分组路并成功(echo 来自组内成员)', /echo:(gpt-3\.5-turbo|gpt-4)/.test(byGroup.text), JSON.stringify(byGroup).slice(0, 160))

    console.log('--- 5) 套餐门控：分组只关联 pro，翻转用户套餐验证可见性 ---')
    r = await req('/api/admin/model-groups', { method: 'POST', jar: admin, body: { name: `smoke-pro-only-${Date.now()}` } })
    proOnlyId = r.data?.data?.id
    check('建 pro 专属分组', !!proOnlyId, JSON.stringify(r))
    // 读取 pro 现有 groupIds，追加专属分组后写回（不破坏既有关联）
    r = await req('/api/admin/plans', { jar: admin })
    const proPlan = (r.data?.data || []).find((p) => p.id === 'pro')
    proOriginalGroupIds = proPlan?.groupIds || []
    r = await req('/api/admin/plans/pro', { method: 'PATCH', jar: admin, body: { groupIds: [...proOriginalGroupIds, proOnlyId] } })
    check('pro 套餐关联专属分组', r.data?.success === true, JSON.stringify(r))

    // 注册全新用户（自动登录），用 admin API 翻转套餐 free/pro，避免依赖种子用户密码
    r = await req('/api/auth/register', { method: 'POST', jar: gate, body: { name: '门控用户', email: gateEmail, password: 'pass123456' } })
    check('门控测试用户注册并登录', r.status === 200 && r.data?.success && !!gate.value, JSON.stringify(r).slice(0, 160))
    r = await req('/api/admin/users', { jar: admin })
    gateUserId = (r.data?.data || []).find((u) => u.email === gateEmail)?.id
    check('取到门控用户 id', !!gateUserId, '未找到注册用户')

    // 置为 free：看不到 pro 专属分组
    await req(`/api/admin/users/${gateUserId}`, { method: 'PATCH', jar: admin, body: { planId: 'free' } })
    const g1 = await req('/api/model-groups', { jar: gate })
    const freeHas = (g1.data?.data || []).some((g) => g.id === proOnlyId)
    check('free 用户看不到 pro 专属分组', g1.data?.success === true && freeHas === false, JSON.stringify(g1.data).slice(0, 200))

    // 置为 pro：能看到 pro 专属分组
    await req(`/api/admin/users/${gateUserId}`, { method: 'PATCH', jar: admin, body: { planId: 'pro' } })
    const g2 = await req('/api/model-groups', { jar: gate })
    const proHas = (g2.data?.data || []).some((g) => g.id === proOnlyId)
    check('pro 用户能看到 pro 专属分组', g2.data?.success === true && proHas === true, JSON.stringify(g2.data).slice(0, 200))

    console.log('--- 9) 图片生成：开启 imageGen 后走 /images/generations ---')
    // 复用 grpId（成员指向假上游）。开启图片生成模式后，普通消息应被当 prompt 生图。
    let ir = await req(`/api/admin/model-groups/${grpId}`, { method: 'PATCH', jar: admin, body: { imageGen: true } })
    check('PATCH 开启 imageGen', ir.data?.success === true && ir.data?.data?.imageGen === true, JSON.stringify(ir))
    const chatHitsBeforeImg = chatHits
    const imageHitsBeforeImg = imageHits
    let meImg = await req('/api/auth/me', { jar: admin })
    const imgMsgBefore = meImg.data?.data?.usedMessages ?? 0
    const ic = await chat(admin, grpId, '一只戴帽子的柴犬')
    check('生图返回 Markdown 图片', /!\[[^\]]*\]\(http:\/\/127\.0\.0\.1:\d+\/img\.png\)/.test(ic.text), JSON.stringify(ic).slice(0, 160))
    check('生图调用了 /images/generations(imageHits +1)', imageHits === imageHitsBeforeImg + 1, `before=${imageHitsBeforeImg} after=${imageHits}`)
    check('生图未调用对话接口(chatHits 不变)', chatHits === chatHitsBeforeImg, `before=${chatHitsBeforeImg} after=${chatHits}`)
    // 生图在流关闭后异步扣额度，轮询等待落库
    let imgMsgAfter = imgMsgBefore
    for (let i = 0; i < 8 && imgMsgAfter < imgMsgBefore + 1; i++) {
      await sleep(200)
      meImg = await req('/api/auth/me', { jar: admin })
      imgMsgAfter = meImg.data?.data?.usedMessages ?? 0
    }
    check('生图计 1 条消息', imgMsgAfter === imgMsgBefore + 1, `before=${imgMsgBefore} after=${imgMsgAfter}`)

    console.log('--- 清理 ---')
    // 还原 pro 套餐分组关联
    await req('/api/admin/plans/pro', { method: 'PATCH', jar: admin, body: { groupIds: proOriginalGroupIds } })
    // 删除门控测试用户
    if (gateUserId) await req(`/api/admin/users/${gateUserId}`, { method: 'DELETE', jar: admin })
    // 删除两个测试分组（级联清理成员/规则/关联）
    r = await req(`/api/admin/model-groups/${grpId}`, { method: 'DELETE', jar: admin })
    check('删除测试分组', r.data?.success === true, JSON.stringify(r))
    if (proOnlyId) await req(`/api/admin/model-groups/${proOnlyId}`, { method: 'DELETE', jar: admin })
    // 还原 openai 提供商
    r = await req('/api/admin/providers/openai', { method: 'PATCH', jar: admin, body: { name: 'OpenAI', enabled: false, apiKey: 'sk-placeholder', baseUrl: 'https://api.openai.com/v1' } })
    check('还原 openai 提供商', r.status === 200 && r.data?.success, JSON.stringify(r))
  } finally {
    // 等 close 回调完成再退出，避免 Windows libuv 在句柄关闭中途 process.exit 触发断言
    await new Promise((resolve) => upstream.close(resolve))
  }

  console.log(`\n==== 模型分组冒烟结果: PASS=${pass} FAIL=${fail} ====`)
  // 退出前留一个短 drain，让 Node/undici 的异步句柄完成关闭，规避 Windows 上 process.exit 触发 libuv 断言
  await new Promise((r) => setTimeout(r, 500))
  process.exit(fail === 0 ? 0 : 1)
}
run().catch((e) => { console.error('SMOKE_CRASH', e); process.exit(2) })

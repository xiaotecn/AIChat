# 🚀 快速启动指南

## 项目已成功运行！

### 🌐 访问地址

- **本地**: http://localhost:3000
- **局域网**: http://192.168.1.12:3000 (可用手机访问)

### 📱 预览方式

1. **PC 浏览器**: 
   - 打开开发者工具 (F12)
   - 点击设备工具栏图标 (Ctrl+Shift+M)
   - 选择移动设备型号 (iPhone 13, Pixel 5 等)

2. **手机真机**:
   - 确保手机和电脑在同一 WiFi
   - 访问: http://192.168.1.12:3000

### ✅ 已完成功能

- ✅ 聊天界面 (支持 Markdown 渲染)
- ✅ 历史记录
- ✅ 个人中心
- ✅ 底部导航栏
- ✅ 响应式动画

### 🎯 下一步开发

#### 1. 接入真实 AI API

编辑 `app/api/chat/route.ts`:

\`\`\`typescript
// 示例：接入 OpenAI
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  const { message } = await request.json()
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: message }],
  })
  
  return NextResponse.json({
    message: completion.choices[0].message.content,
  })
}
\`\`\`

#### 2. 实现流式输出

使用 Server-Sent Events:

\`\`\`typescript
export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      // 流式发送数据
      for await (const chunk of aiResponse) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
\`\`\`

#### 3. 添加用户认证

安装 NextAuth:

\`\`\`bash
npm install next-auth
\`\`\`

### 🛠️ 常用命令

\`\`\`bash
# 开发
npm run dev

# 构建
npm run build

# 生产运行
npm start

# 数据库迁移
npx prisma db push
npx prisma generate
\`\`\`

### 📦 技术栈

- Next.js 15.3 + React 19
- TypeScript
- Tailwind CSS v4
- Zustand (状态管理)
- Prisma (ORM)
- Framer Motion (动画)
- React Markdown

### 🎨 自定义主题

编辑 `app/globals.css` 修改 CSS 变量:

\`\`\`css
:root {
  --primary: 221.2 83.2% 53.3%;  /* 主色调 */
  --radius: 0.5rem;               /* 圆角大小 */
}
\`\`\`

### 📱 打包 Android APP

\`\`\`bash
# 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 初始化
npx cap init

# 添加 Android 平台
npx cap add android

# 构建并同步
npm run build
npx cap sync

# 打开 Android Studio
npx cap open android
\`\`\`

### 🐛 问题排查

如遇到问题，尝试:

1. 清理缓存: `rm -rf .next && npm run dev`
2. 重新安装依赖: `rm -rf node_modules && npm install`
3. 查看日志: 检查浏览器控制台

---

**🎉 享受开发！如有问题随时提问。**

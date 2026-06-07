# AI Chat - 现代化移动端聊天应用

基于 Next.js 15 + React 19 + TypeScript 构建的现代化 AI 聊天应用，专注于移动端体验。

## ✨ 特性

- 🎨 **现代化 UI** - 基于 Tailwind CSS + Shadcn UI
- 📱 **移动端优化** - 专为移动端设计的交互体验
- 🔥 **实时对话** - 支持流式输出的 AI 对话
- 💾 **本地存储** - 使用 Zustand 进行状态管理和持久化
- 🌓 **暗黑模式** - 完整的暗黑模式支持
- ⚡ **性能优化** - React 19 + Next.js 15 带来极致性能
- 📦 **PWA 支持** - 可安装到桌面使用

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 构建生产版本

```bash
npm run build
npm start
```

## 📦 技术栈

- **框架**: Next.js 15 (App Router)
- **UI 库**: React 19
- **样式**: Tailwind CSS + Shadcn UI
- **状态管理**: Zustand
- **数据库**: PostgreSQL + Prisma
- **动画**: Framer Motion
- **Markdown**: react-markdown

## 📱 功能模块

- ✅ 聊天对话（带消息渲染）
- ✅ 历史记录（会话管理）
- ✅ 个人中心（用户信息）
- ✅ 底部导航栏
- ✅ Markdown 渲染
- 🚧 用户认证
- 🚧 订阅管理
- 🚧 真实 AI 接口集成
- 🚧 流式输出
- 🚧 文件上传

## 📂 项目结构

```
ai-chat-app/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   └── chat/          # 聊天 API
│   ├── chat/              # 聊天页面
│   ├── history/           # 历史记录
│   ├── profile/           # 个人中心
│   ├── layout.tsx         # 根布局
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── ui/               # UI 基础组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── textarea.tsx
│   ├── chat/             # 聊天相关组件
│   │   ├── chat-input.tsx
│   │   └── message-list.tsx
│   └── layout/           # 布局组件
│       └── mobile-layout.tsx
├── lib/                  # 工具库
│   ├── prisma.ts        # Prisma 客户端
│   ├── store.ts         # Zustand 状态管理
│   └── utils.ts         # 工具函数
├── prisma/              # Prisma Schema
│   └── schema.prisma
└── public/              # 静态资源
    └── manifest.json    # PWA 配置
```

## 🎯 下一步开发建议

1. **接入真实 AI API**
   - 修改 `app/api/chat/route.ts`
   - 集成 OpenAI/Claude/Gemini 等 API
   - 实现流式输出（SSE）

2. **用户认证系统**
   - 集成 NextAuth.js 或 Clerk
   - 实现登录/注册页面
   - 添加受保护的路由

3. **订阅管理**
   - 创建订阅计划页面
   - 集成支付接口
   - 实现使用量统计

4. **增强功能**
   - 文件上传和图片识别
   - 语音输入
   - 分享对话
   - 导出对话记录

5. **性能优化**
   - 添加加载骨架屏
   - 实现虚拟滚动
   - 优化图片加载

## 📱 移动端打包

### Android

使用 Capacitor：

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
npx cap add android
npm run build
npx cap sync
npx cap open android
```

### iOS (PWA)

在 Safari 中打开网站，点击"添加到主屏幕"

## 🎨 主题定制

修改 `app/globals.css` 中的 CSS 变量来定制主题：

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* ... 更多变量 */
}
```

## 📄 License

MIT

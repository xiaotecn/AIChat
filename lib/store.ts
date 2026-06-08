import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  // 用户带图提问的图片地址（/api/uploads/... 或本地未落盘的 data URI），按需展示
  images?: string[]
  createdAt: Date
  status?: 'sending' | 'success' | 'error'
  // 对应的数据库行 id（持久化后回填），用于「重新生成」时删除旧回复
  dbId?: string
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  // 列表预览（最后一条消息文本）；完整消息按需加载
  preview?: string
  messagesLoaded?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'user'
  planId?: string
  planName?: string | null
  expiresAt?: string | null
  usedTokens: number
  usedMessages: number
  usedImages: number
  tokenLimit: number
  messageLimit: number
  imageLimit: number
  status: 'active' | 'inactive'
  createdAt: Date
}

// 用户可选的模型分组（来自 /api/model-groups，由订阅套餐决定可见性）。
// avatarUrl 为分组自定义头像，聊天页据当前会话所用分组取它作为助手头像。
export interface ModelGroupOption {
  id: string
  name: string
  description: string | null
  memberCount: number
  avatarUrl: string | null
  // 是否为「视觉/图文识别」分组：为真时聊天输入框显示上传图片按钮，允许带图提问
  vision: boolean
}

export interface Plan {
  id: string
  name: string
  description: string
  tokenLimit: number
  messageLimit: number
  price: number
  features: string[]
  enabled: boolean
}

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  models: string[]
  requests: number
  lastTest?: string
}

export interface SystemSettings {
  siteName: string
  description: string
  announcement?: string
  registrationMode: 'open' | 'invite' | 'closed'
  defaultPlanId: string
}

interface ChatStore {
  // 用户相关
  user: User | null
  allUsers: User[]
  setUser: (user: User | null) => void
  loadUser: () => Promise<boolean>
  setAllUsers: (users: User[]) => void
  addUser: (user: User) => void
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => void

  // 会话相关
  conversations: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
  conversationsLoaded: boolean
  selectedModel: string
  modelGroups: ModelGroupOption[]
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  setSelectedModel: (model: string) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  deleteConversation: (id: string) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  setLoading: (loading: boolean) => void
  // 数据库支撑的异步操作
  loadConversations: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
  loadModelGroups: () => Promise<void>
  createConversation: (title: string, modelId: string) => Promise<Conversation | null>
  renameConversation: (id: string, title: string) => Promise<void>
  removeConversation: (id: string) => Promise<void>

  // 套餐相关
  plans: Plan[]
  setPlans: (plans: Plan[]) => void
  addPlan: (plan: Plan) => void
  updatePlan: (id: string, updates: Partial<Plan>) => void
  deletePlan: (id: string) => void

  // AI 提供商相关
  providers: AiProvider[]
  setProviders: (providers: AiProvider[]) => void
  addProvider: (provider: AiProvider) => void
  updateProvider: (id: string, updates: Partial<AiProvider>) => void
  deleteProvider: (id: string) => void

  // 系统设置
  settings: SystemSettings
  setSettings: (settings: Partial<SystemSettings>) => void
}

// 把数据库里存的 images（JSON 字符串）安全解析成字符串数组；空/损坏均返回 undefined。
function parseImages(raw?: string | null): string[] | undefined {
  if (!raw) return undefined
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      const list = arr.filter((x): x is string => typeof x === 'string' && x.length > 0)
      return list.length ? list : undefined
    }
  } catch {
    // 忽略损坏数据
  }
  return undefined
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // 用户相关（由 AuthGate 通过 /api/auth/me 注入真实登录用户）
      user: null,
      allUsers: [],
      setUser: (user) => set({ user }),
      // 拉取当前登录用户并注入 store。AuthGate 初始化用它，个人资料保存后也用它刷新，
      // 使名称/头像在抽屉、资料卡、聊天气泡等处即时生效。
      loadUser: async () => {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' })
          // 明确未登录(401) → 清空并返回 false（AuthGate 据此跳登录）
          if (res.status === 401) {
            set({ user: null })
            return false
          }
          // 其它非 2xx（5xx 等）：不确定，不踢人
          if (!res.ok) return true
          const result = await res.json()
          if (result?.success && result.data) {
            const u = result.data
            set({
              user: {
                id: u.id,
                name: u.name,
                email: u.email,
                avatar: u.avatar ?? undefined,
                role: u.role === 'admin' ? 'admin' : 'user',
                planId: u.planId ?? undefined,
                planName: u.planName ?? null,
                expiresAt: u.expiresAt ?? null,
                usedTokens: u.usedTokens ?? 0,
                usedMessages: u.usedMessages ?? 0,
                usedImages: u.usedImages ?? 0,
                tokenLimit: u.tokenLimit ?? 0,
                messageLimit: u.messageLimit ?? 0,
                imageLimit: u.imageLimit ?? 0,
                status: u.status === 'active' ? 'active' : 'inactive',
                createdAt: new Date(),
              },
            })
            return true
          }
          set({ user: null })
          return false
        } catch (e) {
          console.error('加载用户失败:', e)
          return true // 网络异常：不踢出
        }
      },
      setAllUsers: (users) => set({ allUsers: users }),
      addUser: (user) => set((state) => ({ allUsers: [...state.allUsers, user] })),
      updateUser: (id, updates) =>
        set((state) => ({
          allUsers: state.allUsers.map((u) => (u.id === id ? { ...u, ...updates } : u)),
        })),
      deleteUser: (id) =>
        set((state) => ({
          allUsers: state.allUsers.filter((u) => u.id !== id),
        })),

      // 会话相关
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      conversationsLoaded: false,
      selectedModel: 'gpt-3.5-turbo',
      modelGroups: [],

      setConversations: (conversations) => set({ conversations }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: conversation.id,
        })),

      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, ...updates, updatedAt: new Date() } : conv
          ),
        })),

      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        })),

      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  updatedAt: new Date(),
                }
              : conv
          ),
        })),

      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                }
              : conv
          ),
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      // 从数据库加载当前用户的对话列表（保留已加载的完整消息）
      loadConversations: async () => {
        try {
          const res = await fetch('/api/conversations', { cache: 'no-store' })
          if (!res.ok) {
            set({ conversations: [], conversationsLoaded: true })
            return
          }
          const result = await res.json()
          if (!result.success) return
          set((state) => ({
            conversationsLoaded: true,
            conversations: result.data.map(
              (c: {
                id: string
                title: string
                modelId: string
                createdAt: string
                updatedAt: string
                messages: { content: string }[]
              }) => {
                const existing = state.conversations.find((e) => e.id === c.id)
                return {
                  id: c.id,
                  title: c.title,
                  modelId: c.modelId,
                  createdAt: new Date(c.createdAt),
                  updatedAt: new Date(c.updatedAt),
                  preview: c.messages?.[0]?.content ?? '',
                  // 若此前已加载过完整消息则保留，避免列表刷新覆盖
                  messages: existing?.messagesLoaded ? existing.messages : [],
                  messagesLoaded: existing?.messagesLoaded ?? false,
                }
              }
            ),
          }))
        } catch (e) {
          console.error('加载对话失败:', e)
        }
      },

      // 按需加载某对话的完整消息
      loadMessages: async (conversationId) => {
        try {
          const res = await fetch(`/api/messages?conversationId=${conversationId}`)
          if (!res.ok) return
          const result = await res.json()
          if (!result.success) return
          const messages: Message[] = result.data.map(
            (m: { id: string; role: string; content: string; images?: string | null; createdAt: string; status?: string }) => ({
              id: m.id,
              role: m.role as Message['role'],
              content: m.content,
              images: parseImages(m.images),
              createdAt: new Date(m.createdAt),
              // 生图 pending → 本地 'sending'（重载后会自动续轮询）；error → 'error'；其余 'success'
              status: m.status === 'pending' ? 'sending' : m.status === 'error' ? 'error' : 'success',
              dbId: m.id,
            })
          )
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === conversationId
                ? { ...conv, messages, messagesLoaded: true }
                : conv
            ),
          }))
        } catch (e) {
          console.error('加载消息失败:', e)
        }
      },

      // 加载订阅可见的模型分组（含自定义头像）；当前 selectedModel 不在列表中时默认选第一个。
      // 头像列表只放内存（partialize 白名单不含 modelGroups），不写入 localStorage。
      loadModelGroups: async () => {
        try {
          const res = await fetch('/api/model-groups', { cache: 'no-store' })
          if (!res.ok) return
          const result = await res.json()
          if (!result.success || !Array.isArray(result.data)) return
          const groups = result.data as ModelGroupOption[]
          set((state) => {
            const ids = groups.map((g) => g.id)
            const needsDefault = groups.length > 0 && !ids.includes(state.selectedModel)
            return {
              modelGroups: groups,
              selectedModel: needsDefault ? groups[0].id : state.selectedModel,
            }
          })
        } catch (e) {
          console.error('加载模型分组失败:', e)
        }
      },

      // 在数据库中创建对话，并加入本地状态
      createConversation: async (title, modelId) => {
        try {
          const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, modelId }),
          })
          const result = await res.json()
          if (!result.success) return null
          const conv: Conversation = {
            id: result.data.id,
            title: result.data.title,
            modelId: result.data.modelId,
            messages: [],
            messagesLoaded: true,
            createdAt: new Date(result.data.createdAt),
            updatedAt: new Date(result.data.updatedAt),
          }
          set((state) => ({
            conversations: [conv, ...state.conversations],
            activeConversationId: conv.id,
          }))
          return conv
        } catch (e) {
          console.error('创建对话失败:', e)
          return null
        }
      },

      renameConversation: async (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }))
        try {
          await fetch(`/api/conversations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
        } catch (e) {
          console.error('重命名失败:', e)
        }
      },

      removeConversation: async (id) => {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        }))
        try {
          await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
        } catch (e) {
          console.error('删除对话失败:', e)
        }
      },

      // 套餐相关
      plans: [
        {
          id: 'free',
          name: '免费版',
          description: '适合个人体验',
          tokenLimit: 50000,
          messageLimit: 100,
          price: 0,
          features: ['基础对话', '历史记录', '社区支持'],
          enabled: true,
        },
        {
          id: 'pro',
          name: '专业版',
          description: '适合专业用户',
          tokenLimit: 200000,
          messageLimit: 1000,
          price: 29,
          features: ['无限对话', '优先响应', '高级模型', '邮件支持'],
          enabled: true,
        },
        {
          id: 'enterprise',
          name: '企业版',
          description: '适合团队协作',
          tokenLimit: 500000,
          messageLimit: -1,
          price: 99,
          features: ['所有专业功能', 'API 访问', '专属客服', '定制开发'],
          enabled: true,
        },
      ],
      setPlans: (plans) => set({ plans }),
      addPlan: (plan) => set((state) => ({ plans: [...state.plans, plan] })),
      updatePlan: (id, updates) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deletePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
        })),

      // AI 提供商相关
      providers: [],
      setProviders: (providers) => set({ providers }),
      addProvider: (provider) =>
        set((state) => ({ providers: [...state.providers, provider] })),
      updateProvider: (id, updates) =>
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deleteProvider: (id) =>
        set((state) => ({
          providers: state.providers.filter((p) => p.id !== id),
        })),

      // 系统设置
      settings: {
        siteName: 'AI Chat',
        description: '现代化的 AI 聊天应用',
        registrationMode: 'open',
        defaultPlanId: 'free',
      },
      setSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        // 对话与用户均以数据库/会话为准，不再持久化到 localStorage
        activeConversationId: state.activeConversationId,
        selectedModel: state.selectedModel,
      }),
    }
  )
)

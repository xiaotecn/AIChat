import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始播种数据...')

  // 创建系统设置
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      siteName: 'AI Chat',
      announcement: '欢迎使用 AI Chat！',
      registrationMode: 'open',
    },
  })
  console.log('✅ 系统设置已创建')

  // 创建套餐
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: 'free' },
      update: {},
      create: {
        id: 'free',
        name: '免费版',
        description: '适合个人体验',
        tokenLimit: 50000,
        messageLimit: 100,
        imageLimit: 10,
        resetCycle: 'daily',
        price: 0,
        enabled: true,
      },
    }),
    prisma.plan.upsert({
      where: { id: 'pro' },
      update: {},
      create: {
        id: 'pro',
        name: '专业版',
        description: '适合专业用户',
        tokenLimit: 200000,
        messageLimit: 1000,
        imageLimit: 200,
        resetCycle: 'monthly',
        price: 29,
        enabled: true,
      },
    }),
    prisma.plan.upsert({
      where: { id: 'enterprise' },
      update: {},
      create: {
        id: 'enterprise',
        name: '企业版',
        description: '适合团队协作',
        tokenLimit: 500000,
        messageLimit: -1,
        imageLimit: -1,
        resetCycle: 'monthly',
        price: 99,
        enabled: true,
      },
    }),
  ])
  console.log(`✅ 已创建 ${plans.length} 个套餐`)

  // 创建管理员用户
  const adminPassword = await bcrypt.hash('admin123456', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: '管理员',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active',
      planId: 'enterprise',
      subscriptionStatus: 'active',
    },
  })
  console.log('✅ 管理员用户已创建 (admin@example.com / admin123456)')

  // 创建测试用户
  const testPassword = await bcrypt.hash('test123456', 10)
  const testUsers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'zhangsan@example.com' },
      update: {},
      create: {
        name: '张三',
        email: 'zhangsan@example.com',
        passwordHash: testPassword,
        role: 'user',
        status: 'active',
        planId: 'free',
        subscriptionStatus: 'active',
        usedTokens: 12500,
        usedMessages: 45,
      },
    }),
    prisma.user.upsert({
      where: { email: 'lisi@example.com' },
      update: {},
      create: {
        name: '李四',
        email: 'lisi@example.com',
        passwordHash: testPassword,
        role: 'user',
        status: 'active',
        planId: 'pro',
        subscriptionStatus: 'active',
        usedTokens: 85000,
        usedMessages: 520,
      },
    }),
  ])
  console.log(`✅ 已创建 ${testUsers.length} 个测试用户 (test123456)`)

  // 创建 AI 提供商
  const providers = await Promise.all([
    prisma.aiProvider.upsert({
      where: { id: 'openai' },
      update: {},
      create: {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-placeholder',
        enabled: false,
      },
    }),
    prisma.aiProvider.upsert({
      where: { id: 'anthropic' },
      update: {},
      create: {
        id: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-placeholder',
        enabled: false,
      },
    }),
  ])
  console.log(`✅ 已创建 ${providers.length} 个 AI 提供商`)

  // 创建 AI 模型
  const models = await Promise.all([
    prisma.aiModel.upsert({
      where: { providerId_code: { providerId: 'openai', code: 'gpt-3.5-turbo' } },
      update: { price: 1 },
      create: {
        providerId: 'openai',
        code: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: '快速且经济的模型',
        contextLength: 16385,
        price: 1,
        enabled: true,
      },
    }),
    prisma.aiModel.upsert({
      where: { providerId_code: { providerId: 'openai', code: 'gpt-4' } },
      update: { price: 10 },
      create: {
        providerId: 'openai',
        code: 'gpt-4',
        name: 'GPT-4',
        description: '最强大的模型',
        contextLength: 8192,
        price: 10,
        enabled: true,
      },
    }),
    prisma.aiModel.upsert({
      where: { providerId_code: { providerId: 'anthropic', code: 'claude-3-sonnet' } },
      update: { price: 3 },
      create: {
        providerId: 'anthropic',
        code: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: '平衡性能和成本',
        contextLength: 200000,
        price: 3,
        enabled: true,
      },
    }),
  ])
  console.log(`✅ 已创建 ${models.length} 个 AI 模型`)

  // 创建默认模型分组（平滑上线：现有用户立即可选分组，无需后台手动建组）
  const defaultGroup = await prisma.modelGroup.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: '默认分组',
      description: '系统初始分组，包含全部种子模型',
      enabled: true,
    },
  })

  // 关联 3 个种子模型为成员（order 决定组内轮询顺序）
  await Promise.all(
    models.map((m, order) =>
      prisma.modelGroupMember.upsert({
        where: { groupId_modelId: { groupId: defaultGroup.id, modelId: m.id } },
        update: { order },
        create: { groupId: defaultGroup.id, modelId: m.id, order },
      })
    )
  )

  // 把默认分组授权给全部套餐（现有 free/pro/enterprise 用户立即可用）
  await Promise.all(
    ['free', 'pro', 'enterprise'].map((planId) =>
      prisma.planModelGroup.upsert({
        where: { planId_groupId: { planId, groupId: defaultGroup.id } },
        update: {},
        create: { planId, groupId: defaultGroup.id },
      })
    )
  )

  // 一条演示关键词规则（默认禁用，避免干扰真实对话；后台可启用体验）
  await prisma.keywordRule.upsert({
    where: { id: 'demo-keyword-rule' },
    update: {},
    create: {
      id: 'demo-keyword-rule',
      groupId: defaultGroup.id,
      keyword: '你好',
      matchType: 'contains',
      reply: '你好！我是智能助手，有什么可以帮你的吗？',
      enabled: false,
      order: 0,
    },
  })
  console.log('✅ 默认模型分组已创建（3 个成员 · 关联全部套餐 · 1 条禁用演示规则）')

  console.log('🎉 数据播种完成！')
}

main()
  .catch((e) => {
    console.error('❌ 播种失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

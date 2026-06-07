import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 清除验证过程中产生的测试调用日志
  const deleted = await prisma.apiLog.deleteMany({})
  console.log(`已清除 ${deleted.count} 条测试日志`)

  // 还原种子用户的用量统计
  await prisma.user.updateMany({
    where: { email: 'admin@example.com' },
    data: { usedTokens: 0, usedMessages: 0, usedImages: 0 },
  })
  await prisma.user.updateMany({
    where: { email: 'zhangsan@example.com' },
    data: { usedTokens: 12500, usedMessages: 45, usedImages: 0 },
  })
  console.log('已还原用户用量统计')

  // 还原系统设置为合理默认值（开放注册）
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {
      siteName: '智能海豹 AI',
      description: '移动端智能 AI 对话应用',
      announcement: '欢迎使用 AI Chat！',
      registrationMode: 'open',
      defaultPlanId: null,
    },
    create: { id: 'default' },
  })
  console.log('已还原系统设置')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// 一次性清理：删除冒烟留下的测试用户与临时套餐
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// 先删用户再删套餐：用户被删后冒烟套餐不再被引用，可安全删除（规避外键约束）。
const delUsers = await prisma.user.deleteMany({ where: { email: { startsWith: 'smoke_' } } })
// 覆盖定价冒烟的「冒烟零额度_*」与周期重置冒烟的「冒烟月度套餐」等所有以「冒烟」开头的临时套餐
const delPlans = await prisma.plan.deleteMany({ where: { name: { startsWith: '冒烟' } } })
console.log(`已删除冒烟用户 ${delUsers.count} 个，临时套餐 ${delPlans.count} 个`)
await prisma.$disconnect()

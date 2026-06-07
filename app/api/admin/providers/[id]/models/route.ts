import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 手动为提供商添加一个模型
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    if (!data.code) {
      return NextResponse.json(
        { success: false, error: "模型代码不能为空" },
        { status: 400 }
      )
    }

    const provider = await prisma.aiProvider.findUnique({ where: { id } })
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "提供商不存在" },
        { status: 404 }
      )
    }

    const model = await prisma.aiModel.upsert({
      where: { providerId_code: { providerId: id, code: data.code } },
      update: {
        name: data.name || data.code,
        contextLength: data.contextLength ?? 0,
        enabled: data.enabled ?? true,
        price: data.price,
      },
      create: {
        providerId: id,
        code: data.code,
        name: data.name || data.code,
        description: data.description ?? null,
        contextLength: data.contextLength ?? 0,
        enabled: data.enabled ?? true,
        price: data.price ?? 1,
      },
    })

    return NextResponse.json({ success: true, data: model })
  } catch (error) {
    console.error("Add model error:", error)
    return NextResponse.json(
      { success: false, error: "添加模型失败" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto"
import { fetchProviderModels } from "@/lib/ai"

// 从提供商的 /models 接口（OpenAI 兼容）导入可用模型
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const provider = await prisma.aiProvider.findUnique({ where: { id } })
    if (!provider) {
      return NextResponse.json(
        { success: false, error: "提供商不存在" },
        { status: 404 }
      )
    }

    // 可选：用请求体里临时传入的凭据（编辑弹窗里刚填、尚未保存的 key/baseUrl）；
    // 未传、被打码（•）或无 body 时回退到已存储并解密的凭据。
    const body = (await request.json().catch(() => ({}))) as {
      apiKey?: string
      baseUrl?: string
    }
    const apiKey =
      body.apiKey && !body.apiKey.includes("•")
        ? body.apiKey
        : decryptSecret(provider.apiKey)
    const baseUrl = body.baseUrl || provider.baseUrl

    let modelIds: string[] = []
    try {
      modelIds = await fetchProviderModels(baseUrl, apiKey)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: `获取模型列表失败: ${(e as Error).message}`,
      })
    }

    if (modelIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "提供商未返回任何模型",
      })
    }

    let imported = 0
    for (const code of modelIds) {
      await prisma.aiModel.upsert({
        where: { providerId_code: { providerId: id, code } },
        update: {},
        create: {
          providerId: id,
          code,
          name: code,
          contextLength: 0,
          enabled: true,
        },
      })
      imported++
    }

    return NextResponse.json({
      success: true,
      message: `成功导入 ${imported} 个模型`,
      imported,
      models: modelIds,
    })
  } catch (error) {
    console.error("Import models error:", error)
    return NextResponse.json(
      { success: false, error: "导入模型失败" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto"
import { fetchProviderModels } from "@/lib/ai"

// 拉取某提供商的可用模型列表（用于「测试连接」前选择模型），不写入数据库。
// 支持：直接传 apiKey+baseUrl（新增/编辑时）；或仅传 providerId（用存储并解密的 key）。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { apiKey, baseUrl } = body
    const { providerId } = body

    // 已保存的提供商：前端不回传真实 key（已打码），凭 providerId 取存储 key
    if (providerId && (!apiKey || apiKey.includes("•"))) {
      const p = await prisma.aiProvider.findUnique({ where: { id: providerId } })
      if (p) {
        apiKey = decryptSecret(p.apiKey)
        baseUrl = baseUrl || p.baseUrl
      }
    }

    if (!apiKey || !baseUrl) {
      return NextResponse.json({
        success: false,
        message: "API Key 和 Base URL 是必需的",
      })
    }

    try {
      const models = await fetchProviderModels(baseUrl, apiKey)
      if (models.length === 0) {
        return NextResponse.json({ success: false, message: "提供商未返回任何模型" })
      }
      return NextResponse.json({ success: true, models })
    } catch (e) {
      return NextResponse.json({
        success: false,
        message: `获取模型失败: ${(e as Error).message}`,
      })
    }
  } catch (error) {
    console.error("List models error:", error)
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto"
import { fetchProviderModels } from "@/lib/ai"

// 测试 AI API 连接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { apiKey, baseUrl } = body
    const { providerId, model } = body

    // 编辑已保存的提供商时，前端不会回传真实 key（已打码）。
    // 此时凭 providerId 在服务端取出并解密存储的 key 进行测试。
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

    // 未指定模型时，从 /models 自动取第一个，避免用写死的未知模型
    let testModelCode: string | undefined = model
    if (!testModelCode) {
      try {
        const list = await fetchProviderModels(baseUrl, apiKey)
        if (list.length > 0) testModelCode = list[0]
      } catch {
        // 拉取失败则退回默认模型
      }
    }

    // 测试连接
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: testModelCode || "gpt-3.5-turbo",
          messages: [
            { role: "user", content: "Hello, this is a test message." }
          ],
          max_tokens: 10,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return NextResponse.json({
          success: false,
          message: `API 错误: ${response.status} - ${errorData.error?.message || '未知错误'}`,
        })
      }

      const data = await response.json()

      return NextResponse.json({
        success: true,
        message: "连接测试成功！",
        response: data.choices?.[0]?.message?.content || "测试成功",
      })
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        message: `网络错误: ${error.message}`,
      })
    }
  } catch (error) {
    console.error("Test API error:", error)
    return NextResponse.json({
      success: false,
      message: "服务器错误",
    }, { status: 500 })
  }
}

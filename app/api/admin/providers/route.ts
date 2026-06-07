import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encryptSecret, maskSecret } from "@/lib/crypto"

export async function GET() {
  try {
    const providers = await prisma.aiProvider.findMany({
      include: {
        models: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 计算每个提供商的请求数
    const providersWithStats = await Promise.all(
      providers.map(async (provider) => {
        const requestCount = await prisma.apiLog.count({
          where: {
            providerId: provider.id,
          },
        })

        return {
          ...provider,
          apiKey: maskSecret(provider.apiKey),
          hasApiKey: !!provider.apiKey,
          requests: requestCount,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: providersWithStats,
    })
  } catch (error) {
    console.error("Get providers error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch providers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const provider = await prisma.aiProvider.create({
      data: {
        name: data.name,
        baseUrl: data.baseUrl,
        apiKey: encryptSecret(data.apiKey),
        enabled: data.enabled ?? true,
      },
    })

    return NextResponse.json({
      success: true,
      data: provider,
    })
  } catch (error) {
    console.error("Create provider error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create provider" },
      { status: 500 }
    )
  }
}

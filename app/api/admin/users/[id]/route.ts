import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const updateData: {
      name?: string
      email?: string
      role?: string
      planId?: string | null
      status?: string
      passwordHash?: string
      expiresAt?: Date | null
      subscriptionStatus?: string
    } = {
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
    }

    // planId / expiresAt / subscriptionStatus 仅在显式传入时更新（undefined = 保持不变），
    // 避免只想改某一字段的 PATCH 误清空套餐或到期时间
    if (data.planId !== undefined) updateData.planId = data.planId || null
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
    }
    if (data.subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = data.subscriptionStatus
    }

    // 仅在提供新密码时更新（留空则保持原密码）
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    )
  }
}

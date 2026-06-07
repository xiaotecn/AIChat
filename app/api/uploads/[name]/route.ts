import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { UPLOAD_DIR, MIME_BY_EXT } from "@/lib/image-store"

// 服务落盘的生成图片。文件名含 uuid（不可猜），故公开可读 + 永久缓存。
// 单张图通常几百 KB～几 MB，readFile 的内存占用是瞬时的、请求结束即释放；
// 若要更省（零 Node 内存），可让反代直接服务 UPLOAD_DIR（见 DEPLOY.md）。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params

  // 防目录穿越：只允许「纯文件名.扩展名」，挡掉 / 、.. 等
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(name)) {
    return NextResponse.json({ error: "非法文件名" }, { status: 400 })
  }

  const filePath = path.join(UPLOAD_DIR, name)
  let bytes: Buffer
  try {
    bytes = await fs.readFile(filePath)
  } catch {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 })
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const mime = MIME_BY_EXT[ext] || "application/octet-stream"

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // 文件名含 uuid，内容不会变 → 可永久缓存
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

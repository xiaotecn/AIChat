import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"

// 生成图片落盘目录：数据库只存站内路径，图片字节由 /api/uploads/[name] 服务，不进 app 常驻内存。
// 默认 cwd 下 data/uploads；生产用 UPLOAD_DIR 指向持久化、可备份的卷。
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads")

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
}

// 下载超时：出图后这步只是拉一张已生成好的图（通常 CDN，几百 KB～几 MB），给足 60s 兜底防卡死。
const DOWNLOAD_TIMEOUT_MS = 60_000

/**
 * 把一个图片地址（http(s) 链接，或 data:image base64）下载/解码并落盘，
 * 返回站内可访问路径 `/api/uploads/<uuid>.<ext>`。失败抛出，由调用方回退到原始地址。
 *
 * 目的：上游 /images/generations 常返回临时链接（几小时/几天失效），原样存进会话会过期 404；
 * 落盘后改存站内路径，图片永久有效，且数据库不再承载 base64/大字段（加载会话不吃内存）。
 */
export async function persistImage(src: string): Promise<string> {
  let bytes: Buffer = Buffer.alloc(0)
  let mime = "image/png"

  if (src.startsWith("data:")) {
    const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(src)
    if (!m) throw new Error("无法解析 data URI 图片")
    mime = (m[1] || "image/png").toLowerCase()
    bytes = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]))
  } else {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
    try {
      const res = await fetch(src, { signal: controller.signal })
      if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`)
      mime = (res.headers.get("content-type") || "image/png").split(";")[0].trim().toLowerCase()
      bytes = Buffer.from(await res.arrayBuffer())
    } finally {
      clearTimeout(timer)
    }
  }

  if (bytes.length === 0) throw new Error("图片内容为空")

  const ext = EXT_BY_MIME[mime] || "png"
  const name = `${randomUUID()}.${ext}`
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, name), bytes)
  return `/api/uploads/${name}`
}

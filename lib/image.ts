// 浏览器端图片处理工具。
// 把用户选择的图片等比压缩到「最长边 ≤ max 像素」，输出 base64 data URI（webp 优先，
// 不支持 webp 编码的浏览器回退 png）。直接产出 data URI 便于存进数据库字段
// （如 User.avatar / ModelGroup.avatarUrl），无需任何文件存储设施；单图通常仅 10–30KB。
//
// 仅在客户端（"use client" 组件的事件处理里）调用——内部用到 window.Image / document / canvas。
// 失败时抛出带中文信息的 Error，调用方按自己的方式（toast / alert）提示。
export async function downscaleImageToDataUrl(file: File, max = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件")
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("图片过大，请选择小于 8MB 的图片")
  }

  // 1) 读成 data URI
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("读取图片失败"))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })

  // 2) 解码为 Image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("解析图片失败"))
    image.src = sourceUrl
  })

  // 3) 等比缩放到最长边 ≤ max，画到 canvas
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("当前浏览器不支持图片处理")
  ctx.drawImage(img, 0, 0, w, h)

  // 4) 导出（webp 优先，回退 png）
  let out = canvas.toDataURL("image/webp", 0.85)
  if (!out.startsWith("data:image/webp")) {
    out = canvas.toDataURL("image/png")
  }
  return out
}

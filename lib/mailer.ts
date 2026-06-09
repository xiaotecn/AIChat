import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

export interface MailConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string // 发件人地址（含可选显示名）
  secure: boolean
}

// 从系统设置读取 SMTP 配置；主机/端口/账号/密码任一缺失则返回 null（视为未配置）。
export async function getMailConfig(): Promise<MailConfig | null> {
  const s = await prisma.systemSettings.findUnique({ where: { id: "default" } })
  if (!s?.smtpHost || !s.smtpPort || !s.smtpUser || !s.smtpPass) return null
  return {
    host: s.smtpHost,
    port: s.smtpPort,
    user: s.smtpUser,
    pass: s.smtpPass,
    from: s.smtpFrom?.trim() || s.smtpUser,
    secure: s.smtpSecure,
  }
}

// 用给定配置发送一封邮件。失败抛出错误，调用方决定如何提示。
export async function sendMail(
  cfg: MailConfig,
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // 465→true(SSL)；587→false(STARTTLS)
    auth: { user: cfg.user, pass: cfg.pass },
  })
  await transport.sendMail({
    from: cfg.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  })
}

// 发送注册验证码邮件
export async function sendVerificationCode(cfg: MailConfig, to: string, code: string, siteName: string) {
  const subject = `${siteName} 注册验证码：${code}`
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1d1d20">
    <h2 style="margin:0 0 8px;font-size:20px">${siteName} 注册验证</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">你正在注册 ${siteName}，验证码如下（10 分钟内有效）：</p>
    <div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:12px;padding:16px;text-align:center;color:#111827">${code}</div>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px">若非本人操作，请忽略此邮件。</p>
  </div>`
  await sendMail(cfg, to, subject, html)
}

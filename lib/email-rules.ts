// 注册邮箱域名白名单：解析与校验。

// 解析允许的邮箱域名（逗号 / 空格 / 分号 / 换行分隔，去掉前导 @、转小写）。空 → 返回空数组（= 不限制）。
export function parseAllowedDomains(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean)
}

// 邮箱域名是否允许注册。allowed 为空 = 不限制（全部允许）。
export function isEmailDomainAllowed(email: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  const at = email.lastIndexOf("@")
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase()
  return allowed.includes(domain)
}

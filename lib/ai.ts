import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto"

export interface ResolvedProvider {
  /** Where the credentials came from. */
  source: "db" | "env" | "none"
  baseUrl: string
  apiKey: string
  /** Model code to send to the upstream API, e.g. "gpt-3.5-turbo". */
  model: string
  /** 额度单价：每消耗 1 token 扣除的额度点数（默认 1，数值越大越贵）。 */
  price: number
  /** DB id of the chosen model, when known (exact-model match). 用于回写延迟。 */
  modelId: string | null
  /** DB id of the provider, when source === "db". Used for logging. */
  providerId: string | null
  providerName: string
}

/** API keys seeded as placeholders should be treated as "not configured". */
function isUsableKey(key: string | null | undefined): key is string {
  if (!key) return false
  const k = key.trim()
  return k.length > 0 && !k.toLowerCase().includes("placeholder")
}

/**
 * Decide which AI provider + model an outgoing chat request should use.
 *
 * Resolution order:
 *   1. An enabled DB provider that owns an enabled model matching `modelCode`.
 *   2. Any enabled DB provider that has at least one enabled model (its first model).
 *   3. The OPENAI_API_KEY environment variable (legacy / local-dev path).
 *   4. None — caller should fall back to a mock response.
 */
export async function resolveChatProvider(
  modelCode?: string
): Promise<ResolvedProvider> {
  // 1. Exact model match on an enabled provider.
  if (modelCode) {
    const model = await prisma.aiModel.findFirst({
      where: {
        code: modelCode,
        enabled: true,
        provider: { enabled: true },
      },
      include: { provider: true },
    })
    if (model) {
      const apiKey = decryptSecret(model.provider.apiKey)
      if (isUsableKey(apiKey)) {
        return {
          source: "db",
          baseUrl: model.provider.baseUrl,
          apiKey,
          model: model.code,
          price: model.price,
          modelId: model.id,
          providerId: model.provider.id,
          providerName: model.provider.name,
        }
      }
    }
  }

  // 2. First enabled provider that has a usable key and an enabled model.
  const providers = await prisma.aiProvider.findMany({
    where: { enabled: true },
    include: {
      models: { where: { enabled: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  })
  for (const provider of providers) {
    const apiKey = decryptSecret(provider.apiKey)
    if (isUsableKey(apiKey) && provider.models.length > 0) {
      const chosen =
        (modelCode && provider.models.find((m) => m.code === modelCode)) ||
        provider.models[0]
      return {
        source: "db",
        baseUrl: provider.baseUrl,
        apiKey,
        model: chosen.code,
        price: chosen.price,
        modelId: chosen.id,
        providerId: provider.id,
        providerName: provider.name,
      }
    }
  }

  // 2b. Enabled provider with a usable key but no configured models yet.
  // Still usable — send the requested model code (or a sensible default) so the
  // provider works immediately even before models are imported.
  for (const provider of providers) {
    const apiKey = decryptSecret(provider.apiKey)
    if (isUsableKey(apiKey)) {
      return {
        source: "db",
        baseUrl: provider.baseUrl,
        apiKey,
        model: modelCode || "gpt-3.5-turbo",
        price: 1,
        modelId: null,
        providerId: provider.id,
        providerName: provider.name,
      }
    }
  }

  // 3. Environment fallback (legacy local-dev path).
  if (isUsableKey(process.env.OPENAI_API_KEY)) {
    return {
      source: "env",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY as string,
      model: modelCode || "gpt-3.5-turbo",
      price: 1,
      modelId: null,
      providerId: null,
      providerName: "环境变量 (OPENAI_API_KEY)",
    }
  }

  // 4. Nothing configured.
  return {
    source: "none",
    baseUrl: "",
    apiKey: "",
    model: modelCode || "gpt-3.5-turbo",
    price: 1,
    modelId: null,
    providerId: null,
    providerName: "未配置",
  }
}

/** Rough token estimate when the upstream API doesn't report usage. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  // ~4 chars per token for English; CJK is denser, so bias a little higher.
  return Math.max(1, Math.round(text.length / 3))
}

/**
 * 调用提供商的 `/models`（OpenAI 兼容）拉取可用模型代码列表。
 * 兼容 `{ data: [{ id }] }` 与直接返回数组两种格式。失败时抛出错误。
 */
export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const list = Array.isArray(json) ? json : json.data
  return (list || [])
    .map((m: { id?: string } | string) => (typeof m === "string" ? m : m.id))
    .filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
}

"use client"

import { useChatStore } from "@/lib/store"
import Link from "next/link"
import { ChevronLeft, Settings, ChevronRight, UserRound, ShieldCheck } from "lucide-react"
import { toast } from "@/components/ui/toast"

// ISO → "YYYY-MM-DD"
function ymd(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// 圆形图标按钮的描边阴影（顶栏返回/设置）
const ICON_BTN_SHADOW = "0 1px 8px rgba(0,0,0,.05), inset 0 0 0 1px #eef0f3"
// 会员卡金色渐变
const GOLD_BG =
  "radial-gradient(circle at 74% 20%, rgba(255,255,255,.88), transparent 30%), linear-gradient(95deg, #ffec99 0%, #fff8d6 50%, #fff4df 100%)"

export default function ProfilePage() {
  const { user } = useChatStore()

  const planName = user?.planName || null
  const isFree = !planName || /免费|free/i.test(planName)
  const initial = user?.name?.[0]?.toUpperCase() || "U"

  const msgUsed = user?.usedMessages ?? 0
  const msgLimit = user?.messageLimit ?? 0
  const imgUsed = user?.usedImages ?? 0
  const imgLimit = user?.imageLimit ?? 0
  const msgUnlimited = msgLimit < 0
  const msgPct = msgUnlimited || msgLimit <= 0 ? 0 : Math.min(100, Math.round((msgUsed / msgLimit) * 100))
  const msgLeft = msgUnlimited ? "无限" : Math.max(0, msgLimit - msgUsed)
  const expiry = ymd(user?.expiresAt)

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#e9eaec" }}>
      <div
        className="mx-auto min-h-full w-full max-w-[430px] bg-[#f6f7f9] px-4 pb-8"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        {/* 顶栏 */}
        <nav className="mb-1.5 grid h-11 grid-cols-[44px_1fr_44px] items-center">
          <Link
            href="/chat"
            aria-label="返回"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[#202124]"
            style={{ boxShadow: ICON_BTN_SHADOW }}
          >
            <ChevronLeft className="h-[23px] w-[23px]" strokeWidth={2.6} />
          </Link>
          <div className="text-center text-[18px] font-bold text-[#202124]">个人中心</div>
          <Link
            href="/profile/settings"
            aria-label="设置"
            className="flex h-[38px] w-[38px] items-center justify-center justify-self-end rounded-full bg-white text-[#202124]"
            style={{ boxShadow: ICON_BTN_SHADOW }}
          >
            <Settings className="h-[21px] w-[21px]" strokeWidth={2.1} />
          </Link>
        </nav>

        {/* 头像 + 身份 */}
        <section className="flex items-center gap-3.5 px-0.5 pb-[22px] pt-2.5">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="h-[72px] w-[72px] shrink-0 rounded-full bg-white object-cover p-1"
              style={{ boxShadow: "0 0 0 2px #e0e2e7" }}
            />
          ) : (
            <div
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f6d8ea] via-[#dce8ff] to-[#dcd2f2] text-3xl font-bold text-[#6f86c9]"
              style={{ boxShadow: "0 0 0 2px #e0e2e7" }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <div className="truncate text-[24px] font-bold leading-[1.1] text-[#202124]">{user?.name || "游客"}</div>
              <div className="inline-flex h-[21px] shrink-0 items-center rounded-[11px] border border-[#dde0e5] bg-[#f0f1f3] px-[9px] text-[13px] font-bold text-[#b7bac1]">
                {isFree ? "FREE" : "VIP"}
              </div>
            </div>
            <div className="truncate text-[14px] text-[#8c8f96]">账号 ID：{user?.email || "—"}</div>
          </div>
        </section>

        {/* 会员卡 */}
        {isFree ? (
          <section className="mb-3.5 rounded-[14px] p-5" style={{ background: GOLD_BG }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[31px] font-extrabold leading-none text-[#9b5f00]">AI PRO</div>
              <div className="inline-flex h-6 items-center rounded-xl bg-[#9b5f00]/10 px-2.5 text-[13px] font-bold text-[#9b5f00]">
                未开通
              </div>
            </div>
            <div className="max-w-[270px] text-[14px] font-semibold text-[#bd8b39]">
              开通会员，获得更强模型与更多使用额度
            </div>
            <button
              type="button"
              onClick={() => toast.info("会员开通请联系管理员")}
              className="mt-[18px] h-[42px] w-full rounded-[21px] bg-[#be7300] text-[16px] font-bold text-white"
              style={{ boxShadow: "0 8px 16px rgba(190,115,0,.18)" }}
            >
              立即订阅
            </button>
          </section>
        ) : (
          <section className="mb-3.5 overflow-hidden rounded-[14px] bg-white">
            <div className="flex min-h-[118px] flex-col justify-between px-5 py-[22px]" style={{ background: GOLD_BG }}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-[31px] font-extrabold leading-none text-[#9b5f00]">{planName}</div>
                  <div className="inline-flex h-6 shrink-0 items-center rounded-xl bg-[#9b5f00]/10 px-2.5 text-[13px] font-bold text-[#9b5f00]">
                    已开通
                  </div>
                </div>
                <div className="mt-2 text-[14px] font-semibold text-[#bd8b39]">会员权益已生效</div>
              </div>
              <div className="mt-3.5 text-[13px] text-[#a9782e]">{expiry ? `有效期至 ${expiry}` : "长期有效"}</div>
            </div>
          </section>
        )}

        {/* 今日额度 */}
        <section className="mb-3.5 rounded-[14px] bg-white p-5">
          <div className="mb-[18px] flex items-baseline justify-between">
            <div className="text-[19px] font-bold text-[#202124]">今日额度</div>
            <div className="text-[16px] text-[#272a30]">
              {msgUsed} 次 <span className="text-[#b8bbc1]">/ {msgUnlimited ? "无限" : `${msgLimit} 次`}</span>
            </div>
          </div>
          <div className="mb-3.5 h-2 overflow-hidden rounded-[5px] bg-[#eceef2]">
            <span
              className="block h-full rounded-[inherit] bg-gradient-to-r from-[#2f8df4] to-[#38b6f2]"
              style={{ width: `${msgUnlimited ? 100 : msgPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[14px] text-[#8c8f96]">
            <span>
              今日已使用 <strong className="font-semibold text-[#2e8bf2]">{msgUnlimited ? "充足" : `${msgPct}%`}</strong>
            </span>
            <span>剩余 {msgLeft}{msgUnlimited ? "" : " 次"}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="min-h-[68px] rounded-[10px] bg-[#f7f8fa] px-[9px] py-[11px]">
              <div className="mb-[7px] whitespace-nowrap text-[13px] text-[#8c8f96]">聊天次数</div>
              <div className="whitespace-nowrap text-[17px] font-bold text-[#22242a]">
                {msgUsed} <span className="text-[13px] font-semibold text-[#aeb1b8]">/ {msgUnlimited ? "无限" : `${msgLimit} 次`}</span>
              </div>
            </div>
            <div className="min-h-[68px] rounded-[10px] bg-[#f7f8fa] px-[9px] py-[11px]">
              <div className="mb-[7px] whitespace-nowrap text-[13px] text-[#8c8f96]">图片数量</div>
              <div className="whitespace-nowrap text-[17px] font-bold text-[#22242a]">
                {imgUsed} <span className="text-[13px] font-semibold text-[#aeb1b8]">/ {imgLimit < 0 ? "无限" : `${imgLimit} 张`}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 账号入口 */}
        <section className="rounded-[14px] bg-white px-5">
          <Link
            href="/profile/edit"
            className="flex min-h-[64px] items-center gap-[13px] border-b border-[#eceef2] text-[17px] font-semibold text-[#202124]"
          >
            <UserRound className="h-[26px] w-[26px] shrink-0 text-[#24262b]" strokeWidth={2.1} />
            账号管理
            <span className="ml-auto text-[14px] font-medium text-[#8c8f96]">资料与密码</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#191b20]" />
          </Link>
          <Link
            href="/profile/edit"
            className="flex min-h-[64px] items-center gap-[13px] text-[17px] font-semibold text-[#202124]"
          >
            <ShieldCheck className="h-[26px] w-[26px] shrink-0 text-[#24262b]" strokeWidth={2.1} />
            账号安全
            <span className="ml-auto text-[14px] font-medium text-[#8c8f96]">已保护</span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[#191b20]" />
          </Link>
        </section>
      </div>
    </div>
  )
}

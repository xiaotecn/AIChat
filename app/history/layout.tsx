import { MobileLayout } from "@/components/layout/mobile-layout"

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MobileLayout>{children}</MobileLayout>
}

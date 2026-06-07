import { MobileLayout } from "@/components/layout/mobile-layout"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MobileLayout>{children}</MobileLayout>
}

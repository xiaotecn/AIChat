import { MobileLayout } from "@/components/layout/mobile-layout"

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MobileLayout>{children}</MobileLayout>
}

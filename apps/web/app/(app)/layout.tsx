import { AppShell } from "@/components/app-shell";
import { getCurrentMerchant } from "@/lib/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const merchant = await getCurrentMerchant();
  return <AppShell merchant={merchant}>{children}</AppShell>;
}

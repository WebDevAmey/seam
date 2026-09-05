import { Sidebar } from "@/components/sidebar";

type Merchant = { id: string; name: string; email: string } | null;

export function AppShell({ children, merchant }: { children: React.ReactNode; merchant: Merchant }) {
  return (
    <div className="flex min-h-screen bg-[#050505]">
      <Sidebar merchant={merchant} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

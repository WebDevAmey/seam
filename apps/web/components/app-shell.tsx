"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/recovery/map", label: "Leak map" },
  { href: "/recovery/queue", label: "Recovery queue" },
  { href: "/recovery/ledger", label: "Ledger" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule">
        <div className="flex items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/recovery/map" className="text-[15px] font-semibold tracking-tight">
            Seam
          </Link>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    active ? "bg-ink text-paper" : "text-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

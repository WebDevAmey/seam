"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map as MapIcon,
  ListChecks,
  TrendingUp,
  MessagesSquare,
  Newspaper,
  Link2,
  Bot,
  Sparkles,
  Globe,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

type NavItem = { label: string; href: string; icon: React.ReactNode };
type NavGroup = { label: string; items: NavItem[] };

const ICON = "size-4";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/recovery", icon: <LayoutDashboard className={ICON} strokeWidth={1.6} /> }],
  },
  {
    label: "Recover",
    items: [
      { label: "Leak map", href: "/recovery/map", icon: <MapIcon className={ICON} strokeWidth={1.6} /> },
      { label: "Recovery queue", href: "/recovery/queue", icon: <ListChecks className={ICON} strokeWidth={1.6} /> },
    ],
  },
  {
    label: "Understand",
    items: [
      { label: "Leak intelligence", href: "/recovery/intelligence", icon: <TrendingUp className={ICON} strokeWidth={1.6} /> },
      { label: "Weekly digest", href: "/recovery/digest", icon: <Newspaper className={ICON} strokeWidth={1.6} /> },
    ],
  },
  {
    label: "Respond",
    items: [
      { label: "Conversations", href: "/recovery/tickets", icon: <MessagesSquare className={ICON} strokeWidth={1.6} /> },
      { label: "Chat with your store", href: "/recovery/chat", icon: <Sparkles className={ICON} strokeWidth={1.6} /> },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Agents", href: "/recovery/agents", icon: <Bot className={ICON} strokeWidth={1.6} /> },
      { label: "Ledger", href: "/recovery/ledger", icon: <Link2 className={ICON} strokeWidth={1.6} /> },
    ],
  },
];

type Merchant = { id: string; name: string; email: string } | null;

export function Sidebar({ merchant }: { merchant: Merchant }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0c0c0c]">
      <Link href="/recovery" className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#3b82f6] text-[13px] font-bold text-white">
          S
        </span>
        <span className="font-heading text-[15px] font-semibold tracking-tight text-[#f0f0f0]">Seam</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#5a5a5a]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/recovery" ? pathname === item.href : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[#3b82f6]/15 text-[#60a5fa]"
                        : "text-[#8a8a8a] hover:bg-white/[0.04] hover:text-[#f0f0f0]"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#8a8a8a] transition-colors hover:bg-white/[0.04] hover:text-[#f0f0f0]"
        >
          <Globe className={ICON} strokeWidth={1.6} />
          View site
        </Link>
      </div>

      {merchant && (
        <form action={logout} className="border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[#f0f0f0]">{merchant.name}</p>
              <p className="truncate text-[11px] text-[#5a5a5a]">{merchant.email}</p>
            </div>
            <button
              type="submit"
              title="Sign out"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#5a5a5a] hover:bg-[#3b82f6]/10 hover:text-[#60a5fa]"
            >
              <LogOut className="size-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}

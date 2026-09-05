"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#agents", label: "Agents" },
  { href: "/recovery/ledger", label: "Ledger" },
] as const;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number; visible: boolean }>({
    left: 0,
    width: 0,
    visible: false,
  });

  const activeIndex = NAV_LINKS.findIndex((l) => pathname === l.href);

  const moveTo = (index: number) => {
    const el = linkRefs.current[index];
    const nav = navRef.current;
    if (!el || !nav) return;
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setIndicator({ left: box.left - navBox.left, width: box.width, visible: true });
  };

  const settleToActive = () => {
    if (activeIndex >= 0) moveTo(activeIndex);
    else setIndicator((i) => ({ ...i, visible: false }));
  };

  useIsoLayoutEffect(() => {
    settleToActive();
    const onResize = () => settleToActive();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const [mounted, setMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setOpenState = (next: boolean) => {
    if (next) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMounted(true);
      requestAnimationFrame(() => setOpen(true));
    } else {
      setOpen(false);
      closeTimer.current = setTimeout(() => setMounted(false), 320);
    }
  };

  useEffect(() => setOpenState(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenState(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => () => closeTimer.current && clearTimeout(closeTimer.current), []);

  return (
    <header className="fixed top-0 left-0 right-0 z-100 px-3 pt-3 sm:px-4 sm:pt-4" data-nav aria-label="Primary navigation">
      <div className="nav-outer-shell mx-auto w-full max-w-295 rounded-full p-1">
        <div className="nav-shell flex items-center justify-between gap-4 rounded-full px-3 py-2 sm:gap-6 sm:px-4 sm:py-2.5">
          <Link
            className="group/logo inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 font-bold transition-transform duration-150 ease-custom active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-accent-saffron/50 focus-visible:outline-offset-2"
            href="/"
            aria-label="Seam home"
          >
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent-saffron text-[13px] font-bold text-white transition-transform duration-300 ease-custom group-hover/logo:rotate-[-8deg]">
              S
            </span>
            <span className="font-serif text-2xl tracking-[-0.04em] text-text-primary">eam</span>
          </Link>

          <nav ref={navRef} onMouseLeave={settleToActive} className="relative hidden items-center min-[861px]:flex">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-accent-saffron-light"
              style={{
                left: indicator.left,
                width: indicator.width,
                height: "calc(100% - 8px)",
                opacity: indicator.visible ? 1 : 0,
                transition: "left 280ms cubic-bezier(0.16,1,0.3,1), width 280ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease-out",
              }}
            />
            {NAV_LINKS.map((link, i) => {
              const isActive = activeIndex === i;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  ref={(el) => {
                    linkRefs.current[i] = el;
                  }}
                  onMouseEnter={() => moveTo(i)}
                  onFocus={() => moveTo(i)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium tracking-tight transition-colors duration-200 ease-custom focus-visible:outline-3 focus-visible:outline-accent-saffron/50 focus-visible:outline-offset-2 ${
                    isActive ? "text-accent-saffron-deep" : "text-text-secondary fine-hover:text-text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition-colors duration-200 ease-custom fine-hover:text-text-primary sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              className="group/cta relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-full bg-accent-saffron pl-4 pr-1.5 text-xs text-white shadow-[0_4px_16px_rgba(5,98,239,0.28)] transition-[transform,box-shadow] duration-200 ease-custom fine-hover:shadow-[0_6px_24px_rgba(5,98,239,0.4)] active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-accent-saffron/50 focus-visible:outline-offset-2 sm:pl-5 sm:text-sm"
              href="/signup"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 ease-custom motion-reduce:hidden"
              />
              <span className="relative">Get Started</span>
              <span
                aria-hidden="true"
                className="relative flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/15 transition-all duration-300 rotate-45 ease-custom group-hover/cta:rotate-0 group-hover/cta:scale-105 sm:h-7 sm:w-7"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setOpenState(!open)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-primary transition-[transform,background-color] duration-200 ease-custom fine-hover:bg-black/5 active:scale-[0.94] focus-visible:outline-3 focus-visible:outline-accent-saffron/50 focus-visible:outline-offset-2 min-[861px]:hidden"
            >
              <span className="relative block h-4 w-5" aria-hidden="true">
                <span
                  className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-current transition-transform duration-300 ease-custom ${
                    open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[2px]"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 block h-[1.7px] w-full -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ease-out ${
                    open ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-[1.5px] w-full rounded-full bg-current transition-transform duration-300 ease-custom ${
                    open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[2px]"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {mounted && (
        <div id="mobile-nav" data-open={open} className="nav-mobile-overlay fixed inset-0 -z-10 flex flex-col bg-bg-primary/90 backdrop-blur-2xl min-[861px]:hidden">
          <div className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-light">Navigate</span>
          </div>

          <nav className="flex flex-1 flex-col justify-center gap-1 px-6 sm:px-8">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ ["--i" as string]: i }}
                className="nav-mobile-item group/m-item flex items-center justify-between border-b border-border-primary py-4 font-serif text-4xl tracking-tight text-text-primary transition-colors duration-200 ease-custom sm:text-5xl"
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-black/5 text-base text-text-light transition-transform duration-200 ease-custom group-hover/m-item:translate-x-0.5 group-hover/m-item:-translate-y-0.5"
                >
                  →
                </span>
              </Link>
            ))}
          </nav>

          <div className="nav-mobile-item px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-8" style={{ ["--i" as string]: NAV_LINKS.length }}>
            <Link
              href="/signup"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-accent-saffron px-5 text-base font-semibold text-white shadow-[0_4px_16px_rgba(5,98,239,0.28)] transition-transform duration-200 ease-custom active:scale-[0.98]"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

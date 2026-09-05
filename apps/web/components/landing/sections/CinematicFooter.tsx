"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type MagneticButtonProps = { children: React.ReactNode; href: string; className: string };

function MagneticButton({ children, href, className }: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.25;
      gsap.to(el, { x, y, duration: 0.3, ease: "power2.out" });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <a ref={ref} href={href} className={className}>
      {children}
    </a>
  );
}

const MARQUEE_ITEMS = [
  { text: "Leak Detection", type: "text" },
  { text: "✦", type: "saffron" },
  { text: "Diagnosis Agent", type: "text" },
  { text: "✦", type: "indigo" },
  { text: "Shield", type: "text" },
  { text: "✦", type: "saffron" },
  { text: "Recovery Executor", type: "text" },
  { text: "✦", type: "indigo" },
  { text: "Leak Intelligence", type: "text" },
  { text: "✦", type: "saffron" },
  { text: "Weekly Digest", type: "text" },
  { text: "✦", type: "indigo" },
  { text: "Shopify Connected", type: "text" },
  { text: "✦", type: "saffron" },
  { text: "Chat With Your Store", type: "text" },
  { text: "✦", type: "indigo" },
  { text: "Hash-Chained Ledger", type: "text" },
  { text: "✦", type: "saffron" },
] as const;

export function CinematicFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const footer = footerRef.current;
    const heading = headingRef.current;
    const actions = actionsRef.current;
    const badge = badgeRef.current;
    if (!footer || !heading || !actions || !badge) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const triggers: ScrollTrigger[] = [];

    if (!prefersReduced) {
      const triggerBase = { trigger: footer, start: "top 85%", toggleActions: "play none none none" };
      triggers.push(
        ScrollTrigger.create({
          ...triggerBase,
          onEnter: () => gsap.fromTo(heading, { opacity: 0, y: 56, skewY: 2 }, { opacity: 1, y: 0, skewY: 0, duration: 1.1, ease: "expo.out" }),
        }),
        ScrollTrigger.create({
          ...triggerBase,
          onEnter: () => gsap.fromTo(actions, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.85, ease: "expo.out", delay: 0.18 }),
        }),
        ScrollTrigger.create({
          ...triggerBase,
          onEnter: () => gsap.fromTo(badge, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)", delay: 0.36 }),
        }),
      );
    }

    return () => triggers.forEach((t) => t.kill());
  }, []);

  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <footer ref={footerRef} className="relative min-h-[100svh] bg-[#0D0D0D] overflow-hidden flex flex-col justify-end font-sans" role="contentinfo" aria-label="Site footer">
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: "radial-gradient(circle at 50% 50%, color-mix(in oklch, #0562EF 15%, transparent) 0%, color-mix(in oklch, #0D0D0D 10%, transparent) 40%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[26vw] font-black text-transparent select-none pointer-events-none whitespace-nowrap leading-none z-0"
        style={{ WebkitTextStroke: "1px rgba(5, 98, 239, 0.07)" }}
        aria-hidden="true"
      >
        SEAM
      </div>

      <div className="overflow-hidden -rotate-2 scale-110 relative z-10 mb-14" aria-hidden="true">
        <div className="flex gap-10 w-max animate-cf-scroll text-[0.775rem] font-bold tracking-wider uppercase text-[#F4F1EC]/50 py-3">
          {doubled.map((item, i) => {
            if (item.type === "saffron") return <span key={i} className="text-accent-saffron/60">{item.text}</span>;
            if (item.type === "indigo") return <span key={i} className="text-accent-indigo/60">{item.text}</span>;
            return <span key={i}>{item.text}</span>;
          })}
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-10 w-full">
        <h2
          ref={headingRef}
          className="text-[clamp(3rem,8vw,8rem)] font-extrabold leading-[0.94] tracking-[-0.04em] text-[#F4F1EC] mb-8 [will-change:opacity,transform]"
          style={{ opacity: 0 }}
        >
          Ready to begin?
        </h2>

        <div ref={actionsRef} className="flex flex-wrap gap-3.5 mb-8 [will-change:opacity,transform]" style={{ opacity: 0 }}>
          <MagneticButton
            href="/signup"
            className="inline-flex min-h-13 items-center justify-center rounded-full bg-accent-saffron px-8 text-base font-bold text-white shadow-[0_8px_28px_rgba(5,98,239,0.32)] transition-shadow duration-200 hover:shadow-[0_12px_36px_rgba(5,98,239,0.45)]"
          >
            Get Started
          </MagneticButton>
        </div>

        <span ref={badgeRef} className="inline-flex items-center gap-1.5 py-1 px-3.5 rounded-full bg-accent-saffron/10 border border-accent-saffron/20 text-accent-saffron/85 text-xs font-medium [will-change:opacity,transform]" style={{ opacity: 0 }}>
          <span aria-hidden="true">◆</span>
          Razorpay AI Buildathon 2026 · Track 05
        </span>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto py-10 px-6 w-full border-t border-[#F4F1EC]/7 grid grid-cols-1 min-[601px]:grid-cols-2 min-[901px]:grid-cols-3 gap-8">
        <div>
          <p className="text-[0.65rem] font-bold tracking-widest uppercase text-[#F4F1EC]/30 mb-4">Product</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            <li><a href="/" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Home</a></li>
            <li><a href="#how-it-works" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">How it Works</a></li>
            <li><a href="#features" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Features</a></li>
            <li><a href="/recovery/agents" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Agent Fleet</a></li>
            <li><a href="/recovery/ledger" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Ledger</a></li>
          </ul>
        </div>

        <div>
          <p className="text-[0.65rem] font-bold tracking-widest uppercase text-[#F4F1EC]/30 mb-4">Docs</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            <li>
              <a href="https://github.com/WebDevAmey/seam" target="_blank" rel="noopener noreferrer" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 inline-flex items-center gap-1.5 hover:text-accent-saffron">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 5.02 3.26 9.28 7.78 10.79.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.17.69-3.84-1.34-3.84-1.34-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.53-.29-5.19-1.27-5.19-5.63 0-1.24.44-2.26 1.17-3.06-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.17a10.9 10.9 0 0 1 2.86-.39c.97 0 1.94.13 2.86.39 2.18-1.48 3.14-1.17 3.14-1.17.62 1.57.23 2.73.11 3.02.73.8 1.17 1.82 1.17 3.06 0 4.37-2.67 5.34-5.21 5.62.41.36.77 1.06.77 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.21.66.79.55C19.76 20.79 23 16.53 23 11.52 23 5.24 18.27.5 12 .5Z" />
                </svg>
                GitHub
              </a>
            </li>
            <li><a href="/recovery/digest" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Weekly Digest</a></li>
          </ul>
        </div>

        <div>
          <p className="text-[0.65rem] font-bold tracking-widest uppercase text-[#F4F1EC]/30 mb-4">Account</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            <li><a href="/login" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Sign in</a></li>
            <li><a href="/signup" className="text-[0.8rem] text-[#F4F1EC]/50 no-underline transition-colors duration-200 hover:text-accent-saffron">Create account</a></li>
          </ul>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto py-5 px-6 pb-7 w-full border-t border-[#F4F1EC]/7 flex flex-col md:flex-row md:justify-between items-center gap-3">
        <p className="text-[0.75rem] text-[#F4F1EC]/30 m-0">&copy; 2026 Seam. Standalone build for the Razorpay AI Buildathon.</p>
        <p className="text-[0.75rem] text-[#F4F1EC]/30 m-0">Made in India</p>
      </div>
    </footer>
  );
}

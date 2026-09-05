"use client";

import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { TextRotate } from "@/components/landing/ui/text-rotate";
import Floating, { FloatingElement } from "@/components/landing/ui/parallax-floating";
import { ParticleField } from "@/components/landing/ui/particle-field";

// Illustrative mockups of what Seam actually does, not screenshots of a
// real product passed off as one. Small, honest snippets of the real
// concepts: leak detection, Shield, the ledger, conversations.
function MockCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border-primary bg-white shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function LandingHero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative w-full overflow-hidden px-4 pt-10 pb-16 sm:pt-14 sm:pb-20 md:pt-20 lg:pt-24">
      <ParticleField className="pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,var(--accent-saffron-glow),transparent_70%)] blur-2xl sm:h-[560px] sm:w-[560px]" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-8%] h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,var(--accent-indigo-light),transparent_70%)] blur-2xl" />

      <div className="relative z-10 mx-auto grid w-[calc(100%-24px)] pt-30 max-w-[1180px] grid-cols-1 items-center gap-12 sm:w-[calc(100%-32px)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div className="flex flex-col items-start text-left">
          <motion.h1
            className="flex flex-col gap-1 font-serif font-semibold leading-[1.05] tracking-tight text-text-primary text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem]"
            animate={{ opacity: 1, y: 0 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: 0.2 }}
          >
            <span>One AI that</span>
            <TextRotate
              texts={[
                "finds the leak.",
                "diagnoses the cause.",
                "recovers what it can.",
                "blocks what it shouldn't send.",
                "proves every rupee, on-chain.",
              ]}
              mainClassName="overflow-hidden whitespace-nowrap text-accent-saffron rounded-xl"
              staggerDuration={0.03}
              staggerFrom="last"
              rotationInterval={3000}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
            />
          </motion.h1>

          <motion.p
            className="mt-5 max-w-[34rem] font-sans text-base text-text-secondary sm:mt-6 sm:text-lg"
            animate={{ opacity: 1, y: 0 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: 0.35 }}
          >
            Seam connects your Shopify checkout to your Razorpay payments, finds every rupee you lose
            and why, then sends a recovery message only when it's worth it. A safety layer checks every
            action first, and no AI model can talk its way around it.
          </motion.p>

          <motion.div
            className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4"
            animate={{ opacity: 1, y: 0 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: 0.5 }}
          >
            <motion.a
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent-saffron px-7 py-3.5 text-center text-base font-bold tracking-tight text-white shadow-[0_8px_28px_rgba(5,98,239,0.3)]"
              whileHover={{ scale: 1.05, transition: { type: "spring", damping: 30, stiffness: 400 } }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started
            </motion.a>
            <motion.a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-border-strong bg-white px-7 py-3.5 text-center text-base font-semibold tracking-tight text-text-primary shadow-sm"
              whileHover={{ scale: 1.05, transition: { type: "spring", damping: 30, stiffness: 400 } }}
              whileTap={{ scale: 0.97 }}
            >
              See How it Works
            </motion.a>
          </motion.div>
        </div>

        <div className="relative h-[300px] sm:h-[380px] lg:h-[460px]">
          <Floating sensitivity={shouldReduceMotion ? 0 : -0.4} className="h-full">
            <FloatingElement depth={1} className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
              >
                <MockCard className="w-[230px] sm:w-[300px] lg:w-[360px]">
                  <div className="flex items-center gap-2 border-b border-border-primary bg-bg-secondary px-3 py-2">
                    <AlertTriangle size={13} className="text-accent-saffron" strokeWidth={2} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-light">Leak detected</span>
                  </div>
                  <div className="p-3.5">
                    <p className="font-mono text-[22px] font-bold text-text-primary">₹4,200</p>
                    <p className="mt-0.5 text-[12px] text-text-secondary">PAYMENT_BLOCKED · checkout_8f3k</p>
                  </div>
                </MockCard>
              </motion.div>
            </FloatingElement>

            <FloatingElement depth={2.5} className="left-[2%] top-[6%] sm:left-[0%] sm:top-[4%]">
              <motion.div
                className="-rotate-[6deg]"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.65, ease: "easeOut" }}
              >
                <MockCard className="w-[110px] sm:w-[150px] md:w-[170px]">
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5">
                    <ShieldCheck size={14} className="text-accent-teal" strokeWidth={2} />
                    <span className="text-[10px] font-bold text-text-primary">Shield: PASS</span>
                  </div>
                </MockCard>
              </motion.div>
            </FloatingElement>

            <FloatingElement depth={3.5} className="bottom-[4%] right-[2%] sm:bottom-[2%] sm:right-[0%]">
              <motion.div
                className="rotate-[8deg]"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.85, ease: "easeOut" }}
              >
                <MockCard className="w-[150px] sm:w-[190px] md:w-[210px]">
                  <div className="flex items-start gap-2 p-3">
                    <MessageSquare size={14} className="mt-0.5 shrink-0 text-accent-indigo" strokeWidth={2} />
                    <p className="text-[11px] leading-snug text-text-secondary">&ldquo;will pay in a bit&rdquo;</p>
                  </div>
                </MockCard>
              </motion.div>
            </FloatingElement>

            <FloatingElement depth={1.5} className="right-[6%] top-[10%] sm:right-[4%] sm:top-[8%]">
              <motion.div
                className="rotate-[5deg]"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1.0, ease: "easeOut" }}
              >
                <MockCard className="w-[120px] sm:w-[150px] md:w-[170px]">
                  <div className="flex items-center gap-1.5 px-2.5 py-2.5">
                    <CheckCircle2 size={14} className="text-accent-saffron" strokeWidth={2} />
                    <span className="text-[10px] font-bold text-text-primary">Ledger verified</span>
                  </div>
                </MockCard>
              </motion.div>
            </FloatingElement>
          </Floating>
        </div>
      </div>
    </section>
  );
}

export { LandingHero };

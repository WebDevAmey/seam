"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowDown } from "lucide-react";

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] } },
};

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};

export function ProblemContrast() {
  return (
    <motion.div className="grid gap-4" variants={container} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}>
      <motion.p variants={item} className="text-text-secondary text-[clamp(17px,1.6vw,22px)] leading-1.4 m-0">
        Your storefront analytics say checkout abandonment spiked 40%.
      </motion.p>
      <motion.p variants={item} className="text-text-secondary text-[clamp(17px,1.6vw,22px)] leading-1.4 m-0">
        Neither one tells you:{" "}
        <strong className="text-text-primary">
          &quot;Those customers actually tried to pay, and were declined.&quot;
        </strong>
      </motion.p>

      <motion.div variants={item} className="relative mt-2">
        <div className="relative p-6 pb-7 border border-border-primary rounded-lg bg-white overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-[0.4]"
            style={{ background: "radial-gradient(120% 90% at 100% 0%, rgba(201,75,110,0.08) 0%, transparent 60%)" }}
          />
          <span className="relative inline-block mb-2.5 py-0.5 px-2.5 rounded-full bg-accent-rose/10 text-accent-rose-deep text-[11px] font-extrabold uppercase tracking-wider">
            Before Seam
          </span>
          <p className="relative m-0 text-text-primary text-lg leading-normal">
            &quot;Revenue dropped ₹2.1L yesterday, and neither dashboard can tell you why.&quot;
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-center -my-3.5">
          <motion.span
            className="flex items-center justify-center w-7 h-7 rounded-full border border-border-primary bg-bg-primary text-text-light shadow-sm"
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
          </motion.span>
        </div>

        <div className="relative p-6 pt-7 border border-accent-teal/25 rounded-lg bg-accent-teal/4 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(120% 90% at 0% 100%, rgba(13,155,138,0.1) 0%, transparent 60%)" }}
          />
          <span className="relative inline-block mb-2.5 py-0.5 px-2.5 rounded-full bg-accent-teal/10 text-accent-teal-deep text-[11px] font-extrabold uppercase tracking-wider">
            With Seam
          </span>
          <p className="relative m-0 text-text-primary text-lg leading-normal">
            &quot;₹49,997 across 18 leaks, mostly silent abandons and payment blocks. Traced, not guessed.&quot;
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

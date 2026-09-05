"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Trimmed from Vengeance UI's `agent-bento-grid` down to just the reusable
 * card shell (`FeatCard`) — the registry component's own `Card1`-`Card5` and
 * default `AgentBentoGrid` export are a self-contained marketing demo with
 * hardcoded fake data (fake token counts, fake retrieval logs) and a
 * dependency on `@phosphor-icons/react` this project doesn't otherwise use.
 * Reusing that wholesale would put fake numbers on a real dashboard, which
 * this project's own standing rule (never fake what should show real data)
 * rules out — see the leak map's own bento layout for the real content
 * poured into this shell instead.
 */
interface FeatCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatCard({ title, description, children, className = "" }: FeatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-[20px] p-4",
        "bg-white dark:bg-neutral-900",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="z-10 flex flex-col gap-1.5">
        <h3 className="font-semibold text-foreground text-sm tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed max-w-[90%]">{description}</p>
      </div>
      <div className="relative mt-2 flex-1 w-full rounded-[14px] overflow-hidden border border-border/50 bg-background/50 dark:bg-neutral-950/50">
        {children}
      </div>
    </motion.div>
  );
}

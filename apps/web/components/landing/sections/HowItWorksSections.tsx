"use client";

import { UserPlus, CheckSquare, BarChart2 } from "lucide-react";
import { Accordion } from "@/components/landing/ui/Accordion";

const steps = [
  {
    num: "01",
    Icon: UserPlus,
    heading: "Connect Shopify and Razorpay",
    body: "Seam reads your checkout funnel and payment attempts, joining them at the checkout via the Razorpay notes field, with a scored fallback when that's missing.",
  },
  {
    num: "02",
    Icon: CheckSquare,
    heading: "Every leak gets classified and diagnosed",
    body: "Payment blocked, issuer downtime, silent abandon, or pre-checkout drop. One classifier sorts every leak. Payment failures get a real cause: pattern-matched first, AI-assisted for the rest.",
  },
  {
    num: "03",
    Icon: BarChart2,
    heading: "Seam decides, checks itself, and records everything",
    body: "A recovery message goes out only when it's worth the cost and passes every safety check. Every result, sent, blocked, or escalated, is recorded and can be checked at any time.",
  },
];

const founderViewFeatures = [
  "A weekly digest of what leaked, why, and what got recovered",
  "A live dashboard: leak trends, method reliability, and every decision made",
  "Exact revenue-loss numbers, broken down by cause",
  "A chat agent that answers questions about your own store's data",
];

const faqItems = [
  {
    question: "Who is Seam for?",
    answer:
      "Shopify merchants on Razorpay who want to know exactly where revenue leaks, not just at the payment but before and after it too, and who want recovery gated by real math instead of a blast to everyone.",
  },
  {
    question: "What does Seam actually do?",
    answer:
      "Seam connects your Shopify checkout to your Razorpay payments, sorts every leak into one of six causes, checks whether recovering it is worth the cost, and only acts on the ones that clear that bar.",
  },
  {
    question: "Does Seam message my customers directly?",
    answer:
      "Only when the math and every safety check both pass. Every message is a fixed template plus a real payment link. Never something a model wrote freehand.",
  },
  {
    question: "How much revenue can Seam find?",
    answer:
      "It depends on your store, but Seam catches leak points most tools miss entirely, like silent abandons and pre-checkout drops, not just failed payments. You get an exact number, not a guess.",
  },
  {
    question: "Can I ask Seam questions about my store?",
    answer:
      "Yes. Seam's chat agent answers questions about your own leak, recovery, and ledger data using the same real, tested functions the rest of the product uses. It never states a number it didn't get from a real check.",
  },
  {
    question: "What happens when Seam decides not to act?",
    answer:
      "It stays visible. Every leak that gets blocked or declined shows up in the queue with its exact reason. Hiding the losses would defeat the point.",
  },
  {
    question: "Is my store data safe?",
    answer: "Seam only connects to the Shopify and Razorpay credentials you provide, encrypted at rest, and uses that data only to power detection, diagnosis, and recovery.",
  },
];

export function HowItWorksSections() {
  return (
    <>
      <section className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-secondary border-t border-border-primary" id="how-it-works">
        <div className="max-w-[80rem] mx-auto">
          <div className="text-center mb-12 reveal">
            <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">How it works</p>
            <h2 className="font-serif text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-text-primary leading-[1.15] m-0">
              From connected to covered, in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            {steps.map(({ num, Icon, heading, body }) => (
              <div key={num} className="reveal step flex flex-col rounded-2xl p-7 border-[1.5px] border-border-primary bg-white transition-all duration-240 ease-custom">
                <p className="font-mono text-5xl font-black leading-none text-accent-saffron mb-5">{num}</p>
                <div className="w-10 h-10 rounded-xl bg-accent-saffron/15 flex items-center justify-center mb-4 shrink-0">
                  <Icon size={20} className="text-accent-saffron" strokeWidth={1.8} />
                </div>
                <h3 className="font-sans text-base font-bold text-text-primary mb-2">{heading}</h3>
                <p className="font-sans text-[0.875rem] leading-1.65 text-text-secondary m-0">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-primary border-t border-border-primary">
        <div className="max-w-[80rem] mx-auto reveal">
          <div className="rounded-[1.25rem] p-[clamp(2rem,5vw,3rem)] bg-bg-secondary border border-border-primary grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-12 items-center">
            <div>
              <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">The founder experience</p>
              <h2 className="font-serif text-[clamp(1.5rem,3vw,2rem)] font-bold text-text-primary leading-1.2 mb-4">What you see, in one place</h2>
              <p className="font-sans text-[0.875rem] leading-1.65 text-text-secondary mb-6">
                A leak map, a recovery queue, a named agent fleet, and a ledger you can check yourself. No digging required.
              </p>
              <ul className="list-none p-0 m-0 flex flex-col gap-3">
                {founderViewFeatures.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-[0.875rem] leading-1.6 text-text-secondary font-sans">
                    <span className="text-accent-saffron font-bold shrink-0 mt-[0.05rem] text-[0.8rem]">&#10086;</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative rounded-2xl border border-border-primary bg-white p-6">
              <div className="flex items-center justify-between border-b border-border-primary pb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-text-light">This week</span>
                <span className="rounded-full bg-accent-saffron-light px-2.5 py-0.5 text-[10px] font-bold text-accent-saffron">Live</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-text-light">Leaked</p>
                  <p className="font-mono text-[26px] font-bold text-accent-rose-deep">₹49,997</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-text-light">Recovered (EV)</p>
                  <p className="font-mono text-[26px] font-bold text-accent-teal-deep">₹82</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-2">
                <span className="text-[12px] text-text-secondary">18 leaks · 1 dispatched · 1 blocked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-secondary border-t border-border-primary">
        <div className="max-w-[40rem] mx-auto reveal">
          <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">FAQ</p>
          <h2 className="font-serif text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-text-primary leading-[1.15] mb-10">Common questions.</h2>
          <Accordion items={faqItems} />
        </div>
      </section>
    </>
  );
}

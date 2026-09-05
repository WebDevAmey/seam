"use client";

import { Shield, Activity, Link2 } from "lucide-react";

export function WhySeamSections() {
  return (
    <>
      <section id="why-seam" className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-secondary">
        <div className="max-w-[80rem] mx-auto reveal">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-12 items-center">
            <div className="flex items-center justify-start">
              <span className="font-mono text-[clamp(6rem,15vw,10rem)] font-black leading-none text-accent-saffron/20 select-none">01</span>
            </div>
            <div>
              <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">The problem</p>
              <h2 className="font-serif text-[clamp(1.75rem,4vw,2.25rem)] font-semibold text-accent-saffron leading-1.2 mb-4">
                Your storefront and your payment rail don&apos;t know about the same customer
              </h2>
              <p className="font-sans text-[0.9rem] leading-1.7 text-text-secondary">
                The storefront sees shopping behavior. The payment gateway sees money moving. Neither
                sees both halves. Most &ldquo;recover my failed payments&rdquo; tools only look at the
                payment itself, missing money lost before a payment is even tried, or after it
                succeeds. Seam joins the two where they actually meet: the checkout.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-primary border-t border-border-primary">
        <div className="max-w-[80rem] mx-auto">
          <div className="text-center mb-12 reveal">
            <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">What makes Seam different</p>
            <h2 className="font-serif text-[clamp(1.75rem,4vw,2.5rem)] font-normal text-accent-saffron leading-[1.15]">
              Built for the safety standard a real payments company actually cares about.
            </h2>
          </div>

          <div className="border-t border-border-primary">
            {[
              {
                num: "01",
                Icon: Shield,
                heading: "The model proposes, the code decides",
                body: "A language model can suggest why a payment failed, in a fixed, checkable format. It never writes an amount, a link, or a deadline. Those come from fixed templates and the real payment link, added after.",
              },
              {
                num: "02",
                Icon: Activity,
                heading: "Only worthwhile recovery, never a blast to everyone",
                body: "Seam works out the expected value of recovering a leak: the odds of success times the amount, minus the cost of trying. If it's not worth it, or a safety check fails, nothing gets sent.",
              },
              {
                num: "03",
                Icon: Link2,
                heading: "Every action, on the record",
                body: "Sent, blocked, or escalated: every result gets written to an append-only ledger. You can check it's intact, live, any time.",
              },
            ].map(({ num, Icon, heading, body }) => (
              <div
                key={heading}
                className="group/diff reveal grid grid-cols-[2.5rem_auto] sm:grid-cols-[5rem_auto] items-start gap-5 sm:gap-8 py-7 md:px-4 border-b border-border-primary transition-[padding,background-color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] fine-hover:bg-accent-saffron/3"
              >
                <span className="font-mono text-[0.7rem] font-bold text-text-light pt-1.5 tracking-widest">{num}</span>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-saffron/15 flex items-center justify-center shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/diff:scale-110">
                    <Icon size={20} className="text-accent-saffron" strokeWidth={1.8} />
                  </div>
                  <div className="sm:pt-1">
                    <h3 className="font-sans text-base font-bold text-text-primary mb-2">{heading}</h3>
                    <p className="font-sans text-[0.875rem] leading-1.65 text-text-secondary m-0 max-w-136">{body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[clamp(4rem,8vw,8rem)] px-[clamp(1rem,4vw,1.5rem)] bg-bg-secondary border-t border-border-primary">
        <div className="max-w-[80rem] mx-auto reveal">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-0 rounded-[1.25rem] overflow-hidden border border-border-dark">
            <div className="relative p-[clamp(2rem,5vw,3rem)] bg-bg-dark-soft border-r border-border-dark overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(120% 100% at 0% 0%, rgba(5,98,239,0.16) 0%, rgba(5,98,239,0.04) 38%, transparent 70%)" }}
                aria-hidden="true"
              />
              <div className="relative z-10">
                <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">What it sees</p>
                <h3 className="font-serif text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold text-accent-saffron mb-6 leading-1.2">What Seam watches</h3>
                <ul className="list-none p-0 m-0 flex flex-col gap-3.5">
                  {[
                    "Every checkout event, from cart to payment attempt to fulfilment",
                    "Every Razorpay decline field: code, reason, source, step",
                    "Each payment method's daily failure rate against its own baseline",
                    "Every customer reply to a recovery message, classified in real time",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="text-accent-saffron font-bold shrink-0 mt-[0.05rem] text-[0.8rem]">&#10086;</span>
                      <span className="font-sans text-[0.875rem] leading-1.6 text-white">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-[clamp(2rem,5vw,3rem)] bg-bg-primary">
              <p className="text-[0.7rem] font-bold tracking-[0.2em] uppercase text-accent-saffron font-sans mb-3">What it does</p>
              <h3 className="font-serif text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold text-accent-saffron mb-6 leading-1.2">What Seam does about it</h3>
              <ul className="list-none p-0 m-0 flex flex-col gap-3.5">
                {[
                  "Dispatches a bounded recovery message, only when the EV clears the floor",
                  "Tells you exactly how much revenue leaked, and to which cause",
                  "Holds high-value or ambiguous actions for a human to approve",
                  "Answers plain-English questions about your own store's data",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-accent-saffron font-bold shrink-0 mt-[0.05rem] text-[0.8rem]">&#10086;</span>
                    <span className="font-sans text-[0.875rem] leading-1.6 text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

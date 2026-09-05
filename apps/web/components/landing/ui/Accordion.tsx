"use client";

import { useState, type ReactNode } from "react";

interface AccordionItem {
  question: string;
  answer: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className="border-b border-border-primary">
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between py-5 text-left gap-4 cursor-pointer bg-transparent border-0 outline-none"
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-text-primary font-sans">
                {item.question}
              </span>
              <span className="text-xl font-bold shrink-0 leading-none text-accent-saffron">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <div className="pb-5 text-sm leading-relaxed text-text-secondary font-sans">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { runAnalysisAction } from "./analyze-action";

export function AnalyzeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await runAnalysisAction();
            setMessage(
              result.leaksCreated > 0
                ? `Found ${result.leaksCreated} new concentration ${result.leaksCreated === 1 ? "finding" : "findings"}.`
                : "No new findings today. Nothing looked unusual.",
            );
          })
        }
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Analyzing today's payment mix…" : "Run analysis for today"}
      </button>
      {message && <p className="mt-3 text-[13px] text-muted">{message}</p>}
    </div>
  );
}

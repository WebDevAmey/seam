import { getLeaks } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { AnalyzeButton } from "./analyze-button";

export default async function LeakIntelligencePage() {
  const merchantId = await requireCurrentMerchantId();
  const leaks = await getLeaks(merchantId);
  const findings = leaks.filter((l) => l.class === "METHOD_CONCENTRATION");

  return (
    <div className="px-6 py-8 sm:px-10">
      <h1 className="font-heading text-[20px] font-semibold text-ink">Leak intelligence</h1>
      <p className="mt-1 max-w-[68ch] text-[13px] text-muted">
        Every day, Seam checks each payment method's failure rate against its own normal range. If a
        method suddenly fails a lot more than usual, it shows up here. That's often the first sign of
        a problem on the bank's or gateway's side.
      </p>

      <div className="mt-6">
        <AnalyzeButton />
      </div>

      <div className="mt-6">
        {findings.length === 0 && (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-[13px] text-muted">
                No method-concentration findings yet. Run an analysis, or check back after more payment
                history accumulates.
              </p>
            </CardBody>
          </Card>
        )}
        {findings.length > 0 && (
          <Card>
            {findings.map((leak, i) => (
              <div key={leak.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-rule" : ""}`}>
                <div>
                  <span className="text-[14px] font-medium text-ink">
                    {leak.checkoutId?.replace(/^method:/, "").replace(/:\d{4}-\d{2}-\d{2}$/, "") ?? "unknown method"}
                  </span>
                  <p className="mt-1 text-[12px] text-muted">
                    Detected {new Date(leak.detectedAt).toLocaleString("en-IN")}, confidence{" "}
                    <span className="font-mono-figures">{leak.confidence}</span>
                  </p>
                </div>
                <span className="font-mono-figures text-[14px] font-medium tabular-nums text-at-risk">
                  {formatPaise(leak.amountPaise)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

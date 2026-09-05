import { CheckCircle2, TriangleAlert } from "lucide-react";
import { getDigest } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise, leakClassLabel } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ClassBreakdownChart } from "@/components/charts/class-breakdown-chart";
import { HealthGauge } from "./health-gauge";
import { WoWStat } from "./wow-stat";

export default async function DigestPage() {
  const merchantId = await requireCurrentMerchantId();

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 3_600_000);
  const priorEnd = start;
  const priorStart = new Date(priorEnd.getTime() - 7 * 24 * 3_600_000);

  const [digest, prior] = await Promise.all([
    getDigest(merchantId, { start, end }),
    getDigest(merchantId, { start: priorStart, end: priorEnd }),
  ]);

  const totalLeaked = Number(digest.totalLeakAmountPaise);
  const netRecovered = Number(digest.netRecoveredPaise);
  const recoveryRate = totalLeaked > 0 ? (netRecovered / totalLeaked) * 100 : 0;

  const topLeakClass = [...digest.leaksByClass].sort((a, b) => Number(b.amountPaise) - Number(a.amountPaise))[0];
  const topBlockReason = [...digest.shieldBlockReasons].sort((a, b) => b.count - a.count)[0];

  const wins: string[] = [];
  if (digest.leaksDetected > 0) wins.push(`${digest.leaksDetected} leak${digest.leaksDetected === 1 ? "" : "s"} detected across ${digest.leaksByClass.length} categories`);
  if (Number(digest.totalLeakAmountPaise) > 0) wins.push(`Identified ${formatPaise(digest.totalLeakAmountPaise)} in leaked revenue`);
  if (digest.actionsDispatched > 0) {
    wins.push(
      `${digest.actionsDispatched} recovery message${digest.actionsDispatched === 1 ? "" : "s"} sent, ${formatPaise(digest.netRecoveredPaise)} predicted back`,
    );
  }
  if (recoveryRate > 0) wins.push(`${recoveryRate.toFixed(0)}% of leaked value is being recovered`);
  if (digest.leaksDetected === 0) wins.push("No leaks detected this period");
  if (wins.length === 0) wins.push("Nothing to report yet this period");

  const concerns: string[] = [];
  if (topLeakClass) {
    concerns.push(`${leakClassLabel(topLeakClass.class)} is the biggest source: ${formatPaise(topLeakClass.amountPaise)}`);
  }
  if (digest.actionsBlocked > 0) {
    concerns.push(
      `${digest.actionsBlocked} action${digest.actionsBlocked === 1 ? "" : "s"} blocked${topBlockReason ? `, most often: ${topBlockReason.reason}` : ""}`,
    );
  }
  if (Number(digest.totalLeakAmountPaise) > 1000000) {
    concerns.push(`High leak volume: ${formatPaise(digest.totalLeakAmountPaise)} total this period`);
  }

  return (
    <div className="px-6 py-8 sm:px-10">
      <p className="font-mono-figures text-[11px] uppercase tracking-[0.2em] text-muted">
        {digest.periodStart} to {digest.periodEnd}
      </p>
      <h1 className="mt-1 font-heading text-[24px] font-semibold text-ink">Weekly digest</h1>
      <p className="mt-2 max-w-[64ch] text-[13px] leading-relaxed text-muted">{digest.narrative}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-2">
            <HealthGauge rate={recoveryRate} />
            <p className="max-w-[180px] text-center text-[12px] text-muted">
              Predicted recovery as a share of total leaked value this period.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Week over week</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <WoWStat label="Leaked value" current={Number(digest.totalLeakAmountPaise)} prior={Number(prior.totalLeakAmountPaise)} invert />
            <WoWStat label="Leaks detected" current={digest.leaksDetected} prior={prior.leaksDetected} invert />
            <WoWStat label="Actions dispatched" current={digest.actionsDispatched} prior={prior.actionsDispatched} />
            <WoWStat label="Recovered (EV)" current={Number(digest.netRecoveredPaise)} prior={Number(prior.netRecoveredPaise)} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-recovered/25 bg-recovered/5">
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-recovered" strokeWidth={2} />
              <p className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-recovered">Top wins</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {wins.map((w) => (
                <li key={w} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-recovered" />
                  {w}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="border-pending/25 bg-pending/5">
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
              <TriangleAlert className="size-4 text-pending" strokeWidth={2} />
              <p className="font-mono-figures text-[10px] uppercase tracking-[0.2em] text-pending">Watch these</p>
            </div>
            {concerns.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing needs attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {concerns.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-pending" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {digest.leaksByClass.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Leak value by cause</p>
          </CardHeader>
          <CardBody>
            <ClassBreakdownChart data={digest.leaksByClass} />
          </CardBody>
        </Card>
      )}

      {digest.shieldBlockReasons.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Why Shield blocked actions</p>
          </CardHeader>
          {digest.shieldBlockReasons.map((row, i) => (
            <div key={row.reason} className={`flex items-center justify-between px-5 py-3 text-[13px] ${i > 0 ? "border-t border-rule" : ""}`}>
              <span className="text-ink">{row.reason}</span>
              <span className="font-mono-figures text-muted">{row.count}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

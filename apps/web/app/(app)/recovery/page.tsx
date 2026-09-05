import Link from "next/link";
import { getAnalyticsSummary, getTickets } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TrendChart } from "@/components/charts/trend-chart";
import { ClassBreakdownChart } from "@/components/charts/class-breakdown-chart";
import { MethodChart } from "@/components/charts/method-chart";

const TONE_TEXT: Record<"ink" | "at-risk" | "recovered" | "pending", string> = {
  ink: "text-ink",
  "at-risk": "text-at-risk",
  recovered: "text-recovered",
  pending: "text-pending",
};

function StatCard({
  label,
  value,
  tone = "ink",
  sub,
}: {
  label: string;
  value: string;
  tone?: "ink" | "at-risk" | "recovered" | "pending";
  sub?: string;
}) {
  const toneClass = TONE_TEXT[tone];
  return (
    <Card>
      <CardBody>
        <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
        <p className={`font-mono-figures mt-2 text-[26px] font-semibold tabular-nums ${toneClass}`}>{value}</p>
        {sub && <p className="mt-1 text-[12px] text-muted">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default async function OverviewPage() {
  const merchantId = await requireCurrentMerchantId();
  const [summary, tickets] = await Promise.all([getAnalyticsSummary(merchantId, 14), getTickets(merchantId)]);

  const totalLeaked = summary.dailySeries.reduce((sum, d) => sum + BigInt(d.leakAmountPaise), 0n);
  const totalRecovered = summary.dailySeries.reduce((sum, d) => sum + BigInt(d.recoveredPaise), 0n);
  const openTickets = tickets.filter((t) => t.status === "OPEN").length;

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold text-ink">Overview</h1>
          <p className="mt-1 text-[13px] text-muted">Last 14 days, this merchant&apos;s own data.</p>
        </div>
        <Link
          href="/recovery/agents"
          className="rounded-lg border border-rule bg-surface px-3.5 py-2 text-[13px] font-medium text-ink hover:border-primary hover:text-primary"
        >
          View agent fleet →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Leaked" value={formatPaise(totalLeaked)} tone="at-risk" />
        <StatCard label="Recovered (EV)" value={formatPaise(totalRecovered)} tone="recovered" />
        <StatCard label="Open conversations" value={String(openTickets)} tone={openTickets > 0 ? "pending" : "ink"} />
        <StatCard label="Dispatched actions" value={String(summary.funnel.dispatched)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Leaked vs. recovered, daily</p>
          </CardHeader>
          <CardBody>
            <TrendChart data={summary.dailySeries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Shield decisions</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <FunnelRow label="Leaks detected" value={summary.funnel.leaksDetected} tone="ink" />
            <FunnelRow label="Dispatched" value={summary.funnel.dispatched} tone="recovered" />
            <FunnelRow label="Needs approval" value={summary.funnel.needsApproval} tone="pending" />
            <FunnelRow label="Blocked" value={summary.funnel.blocked} tone="at-risk" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Leak value by cause</p>
          </CardHeader>
          <CardBody>
            {summary.byClass.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted">No leaks in this window.</p>
            ) : (
              <ClassBreakdownChart data={summary.byClass} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Payment method reliability</p>
          </CardHeader>
          <CardBody>
            {summary.byMethod.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted">No payment attempts in this window.</p>
            ) : (
              <MethodChart data={summary.byMethod} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function FunnelRow({ label, value, tone }: { label: string; value: number; tone: "ink" | "recovered" | "pending" | "at-risk" }) {
  const toneClass = TONE_TEXT[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-mono-figures text-[15px] font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

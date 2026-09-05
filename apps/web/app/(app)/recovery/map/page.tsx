import Link from "next/link";
import { getLeaks, type Leak } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { formatPaise } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ChevronRight, Layers, MapPin, ShoppingBag, CalendarClock } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { FeatCard } from "@/components/ui/agent-bento-grid";
import { NumberTicker } from "@/components/ui/number-ticker";
import StatsCounter from "@/components/ui/stats-counter";
import { Progress } from "@/components/ui/progress";
import { LeakGroup } from "./leak-group";

// Recoverable-by-a-message, so they belong in the headline figure.
const HARD_RECOVERABLE = new Set(["PAYMENT_BLOCKED", "ISSUER_DOWNTIME"]);
// Recoverable sometimes, at a lower expected value — shown, never blended
// into the headline number (PRD §5: never sum potential with realized).
const SOFT_RECOVERABLE = new Set(["SILENT_ABANDON"]);

type Group = { leakClass: string; totalPaise: bigint; count: number; leaks: Leak[] };

function groupLeaks(leaks: Leak[]): Group[] {
  const byClass = new Map<string, Group>();
  for (const leak of leaks) {
    const existing = byClass.get(leak.class);
    if (existing) {
      existing.totalPaise += BigInt(leak.amountPaise);
      existing.count += 1;
      existing.leaks.push(leak);
    } else {
      byClass.set(leak.class, { leakClass: leak.class, totalPaise: BigInt(leak.amountPaise), count: 1, leaks: [leak] });
    }
  }
  return Array.from(byClass.values()).sort((a, b) => (b.totalPaise > a.totalPaise ? 1 : -1));
}

function badgeFor(leakClass: string): { label: string; tone: BadgeTone } {
  if (HARD_RECOVERABLE.has(leakClass)) return { label: "Recoverable", tone: "primary" };
  if (SOFT_RECOVERABLE.has(leakClass)) return { label: "Sometimes recoverable", tone: "pending" };
  return { label: "Diagnostic only", tone: "neutral" };
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function LeakMapPage() {
  const merchantId = await requireCurrentMerchantId();
  const leaks = await getLeaks(merchantId);
  const groups = groupLeaks(leaks);

  const recoverableTodayPaise = groups
    .filter((g) => HARD_RECOVERABLE.has(g.leakClass))
    .reduce((sum, g) => sum + g.totalPaise, 0n);

  const detectedDates = leaks.map((l) => new Date(l.detectedAt).getTime()).sort((a, b) => a - b);
  const earliest = detectedDates[0];
  const latest = detectedDates[detectedDates.length - 1];
  const hasActionable = groups.some((g) => HARD_RECOVERABLE.has(g.leakClass));

  const totalLeakedPaise = leaks.reduce((sum, l) => sum + BigInt(l.amountPaise), 0n);
  const recoverableSharePct = totalLeakedPaise > 0n ? Number((recoverableTodayPaise * 100n) / totalLeakedPaise) : 0;

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <Link href="/recovery" className="hover:text-primary">
          Overview
        </Link>
        <ChevronRight className="size-3" strokeWidth={2} />
        <span className="text-ink">Leak map</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-[20px] font-semibold text-ink">Leak map</h1>
        <Badge tone={hasActionable ? "risk" : "neutral"}>{hasActionable ? "Action needed" : "All clear"}</Badge>
      </div>

      {leaks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <ShoppingBag className="size-3.5" strokeWidth={1.8} />
            {leaks.length} checkout{leaks.length === 1 ? "" : "s"} affected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" strokeWidth={1.8} />
            {groups.length} leak class{groups.length === 1 ? "" : "es"}
          </span>
          {earliest !== undefined && latest !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" strokeWidth={1.8} />
              {earliest === latest
                ? `detected ${formatDateShort(leaks[0]!.detectedAt)}`
                : `${formatDateShort(new Date(earliest).toISOString())} – ${formatDateShort(new Date(latest).toISOString())}`}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-1.5">
            {groups.map((g) => {
              const badge = badgeFor(g.leakClass);
              return (
                <Badge key={g.leakClass} tone={badge.tone}>
                  {g.leakClass.replaceAll("_", " ").toLowerCase()}
                </Badge>
              );
            })}
          </span>
        </div>
      )}

      {leaks.length === 0 ? (
        <Card className="mt-6">
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Recoverable today</p>
            <p className="font-mono-figures mt-2 text-[48px] leading-none font-semibold tabular-nums text-at-risk sm:text-[60px]">
              {formatPaise(recoverableTodayPaise)}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <FeatCard
            title="Recoverable today"
            description="Payment-blocked and issuer-downtime leaks only, the ones a message can actually fix. Silent abandons are shown separately, never blended in."
            className="sm:col-span-2 md:col-span-2 min-h-[180px]"
          >
            <div className="flex h-full flex-col justify-between p-4">
              <p className="font-mono-figures text-[36px] leading-none font-semibold tabular-nums text-at-risk">
                ₹<NumberTicker value={Number(recoverableTodayPaise) / 100} className="text-at-risk" />
              </p>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
                  <span>share of all leaked value</span>
                  <span className="font-mono-figures tabular-nums">{recoverableSharePct}%</span>
                </div>
                <Progress value={recoverableSharePct} />
              </div>
            </div>
          </FeatCard>
          <FeatCard title="Checkouts affected" description="Every checkout with at least one detected leak." className="min-h-[180px]">
            <div className="flex h-full flex-col items-center justify-center gap-1">
              <StatsCounter value={leaks.length} className="font-mono-figures text-[32px] font-semibold text-ink" />
              <ShoppingBag className="size-3.5 text-muted" strokeWidth={1.8} />
            </div>
          </FeatCard>
          <FeatCard title="Leak classes" description="Distinct causes found in this window." className="min-h-[180px]">
            <div className="flex h-full flex-col items-center justify-center gap-1">
              <StatsCounter value={groups.length} className="font-mono-figures text-[32px] font-semibold text-ink" />
              <Layers className="size-3.5 text-muted" strokeWidth={1.8} />
            </div>
          </FeatCard>
        </div>
      )}

      <div className="mt-8">
        {groups.length === 0 && (
          <Card>
            <CardBody>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MapPin />
                  </EmptyMedia>
                  <EmptyTitle>No leaks detected yet</EmptyTitle>
                  <EmptyDescription>Run the Leak Detector from the agent fleet, or wait for the next sweep.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardBody>
          </Card>
        )}
        {groups.length > 0 && (
          <>
            <h2 className="font-heading mb-3 text-[14px] font-semibold text-ink">Leak classes</h2>
            <Card>
              {groups.map((group, i) => {
                const badge = badgeFor(group.leakClass);
                return (
                  <div key={group.leakClass} className={i > 0 ? "border-t border-rule" : ""}>
                    <LeakGroup
                      leakClass={group.leakClass}
                      totalPaise={group.totalPaise.toString()}
                      count={group.count}
                      leaks={group.leaks}
                      badgeLabel={badge.label}
                      badgeTone={badge.tone}
                      defaultOpen={i === 0}
                    />
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

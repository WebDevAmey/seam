import { CheckCircle2, Link2, XCircle, ChevronDown, ChevronUp, Shield, Zap, MessageSquare, AlertTriangle, Ban, Clock, ArrowRight } from "lucide-react";
import { VerifyButton } from "@/components/verify-button";
import { getLedgerEntries, verifyLedger } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { EntryDetails } from "./entry-details";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  action_dispatched: { label: "Dispatched", icon: Zap, color: "text-received" },
  action_blocked: { label: "Blocked", icon: Ban, color: "text-at-risk" },
  action_escalated: { label: "Escalated", icon: AlertTriangle, color: "text-pending" },
  action_failed: { label: "Failed", icon: XCircle, color: "text-at-risk" },
  action_needs_approval: { label: "Needs approval", icon: Clock, color: "text-pending" },
  action_reserved: { label: "Reserved", icon: Shield, color: "text-primary" },
  reply_received: { label: "Reply received", icon: MessageSquare, color: "text-muted" },
};

export default async function LedgerPage() {
  const merchantId = await requireCurrentMerchantId();
  const [entries, verification] = await Promise.all([getLedgerEntries(merchantId), verifyLedger()]);

  const byType = new Map<string, number>();
  for (const entry of entries) {
    const type =
      entry.payload && typeof entry.payload === "object" && "type" in entry.payload
        ? String((entry.payload as { type: unknown }).type)
        : "unknown";
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  const typeCounts = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

  const oldest = entries.length > 0 ? entries[entries.length - 1] : undefined;
  const newest = entries.length > 0 ? entries[0] : undefined;

  return (
    <div className="px-6 py-8 sm:px-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-[20px] font-semibold text-ink">Audit Ledger</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-muted">
            Every action this system took, hash-chained from genesis. Tamper any entry and the chain breaks — verification recomputes every hash from scratch.
          </p>
        </div>
        <VerifyButton />
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Entries</p>
            <p className="font-mono-figures mt-1.5 text-[22px] font-semibold text-ink">{entries.length}</p>
            <p className="text-[11px] text-muted">for this merchant</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Chain integrity</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {verification.valid ? (
                <>
                  <CheckCircle2 className="size-4 text-received" strokeWidth={2} />
                  <span className="text-[15px] font-semibold text-received">Verified</span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-at-risk" strokeWidth={2} />
                  <span className="text-[15px] font-semibold text-at-risk">Broken</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted">
              {verification.valid
                ? `${verification.totalEntries} entries, ${verification.merchantsAffected} merchant${verification.merchantsAffected === 1 ? "" : "s"}`
                : `Broke at seq ${verification.brokenAtSeq}`}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">First entry</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink">
              {oldest ? new Date(oldest.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </p>
            <p className="text-[11px] text-muted font-mono-figures">seq {verification.valid ? verification.firstSeq : "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Latest entry</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink">
              {newest ? new Date(newest.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
            </p>
            <p className="text-[11px] text-muted font-mono-figures">seq {verification.valid ? verification.lastSeq : "—"}</p>
          </CardBody>
        </Card>
      </div>

      {/* Breakdown by type */}
      {typeCounts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Actions by type</p>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {typeCounts.map(([type, count]) => {
              const config = TYPE_CONFIG[type];
              const Icon = config?.icon ?? Link2;
              return (
                <Badge key={type} tone="neutral">
                  <span className="flex items-center gap-1.5">
                    <Icon className={`size-3 ${config?.color ?? "text-muted"}`} />
                    {config?.label ?? type}
                    <span className="font-mono-figures text-muted">{count}</span>
                  </span>
                </Badge>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Chain entries */}
      <div className="mt-4">
        {entries.length === 0 ? (
          <Card>
            <CardBody>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Link2 />
                  </EmptyMedia>
                  <EmptyTitle>No ledger entries yet</EmptyTitle>
                  <EmptyDescription>Once Seam dispatches, blocks, or escalates an action for this merchant, it shows up here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardBody>
          </Card>
        ) : (
          <div className="relative">
            {/* Vertical chain line */}
            <div className="absolute left-[23px] top-0 bottom-0 w-px bg-rule" />

            <div className="space-y-0">
              {entries.map((entry, idx) => {
                const payloadType =
                  entry.payload && typeof entry.payload === "object" && "type" in entry.payload
                    ? String((entry.payload as { type: unknown }).type)
                    : "unknown";
                const config = TYPE_CONFIG[payloadType] ?? null;
                const Icon = config?.icon ?? Link2;
                const isLast = idx === entries.length - 1;

                return (
                  <div key={entry.seq} className="relative flex gap-4">
                    {/* Chain node */}
                    <div className="relative z-10 flex h-[46px] w-[46px] shrink-0 items-center justify-center">
                      <div className={`flex size-[30px] items-center justify-center rounded-full border-2 ${
                        verification.valid
                          ? "border-received/30 bg-received/10"
                          : "border-at-risk/30 bg-at-risk/10"
                      }`}>
                        <Icon className={`size-3.5 ${config?.color ?? "text-muted"}`} />
                      </div>
                    </div>

                    {/* Entry card */}
                    <div className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
                      <EntryDetails entry={entry} config={config} payloadType={payloadType} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

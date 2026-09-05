import { CheckCircle2, Link2, XCircle } from "lucide-react";
import { VerifyButton } from "@/components/verify-button";
import { getLedgerEntries, verifyLedger } from "@/lib/api";
import { requireCurrentMerchantId } from "@/lib/actions/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

const TYPE_LABEL: Record<string, string> = {
  action_dispatched: "Dispatched",
  action_blocked: "Blocked",
  action_escalated: "Escalated",
  action_failed: "Failed",
  action_needs_approval: "Needs approval",
  reply_received: "Reply received",
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
          <h1 className="font-heading text-[20px] font-semibold text-ink">Ledger</h1>
          <p className="mt-1 max-w-[62ch] text-[13px] text-muted">
            Every action this system took, hash-chained from genesis. The chain is shared across every
            merchant. This table just filters it to this one.
          </p>
        </div>
        <VerifyButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Entries for this merchant</p>
            <p className="font-mono-figures mt-1.5 text-[22px] font-semibold text-ink">{entries.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Chain status</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {verification.valid ? (
                <>
                  <CheckCircle2 className="size-4 text-recovered" strokeWidth={2} />
                  <span className="text-[15px] font-semibold text-recovered">Verified</span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-at-risk" strokeWidth={2} />
                  <span className="text-[15px] font-semibold text-at-risk">Broken</span>
                </>
              )}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">First entry</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink">
              {oldest ? new Date(oldest.createdAt).toLocaleDateString("en-IN") : "None yet"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">Latest entry</p>
            <p className="mt-1.5 text-[13px] font-medium text-ink">
              {newest ? new Date(newest.createdAt).toLocaleDateString("en-IN") : "None yet"}
            </p>
          </CardBody>
        </Card>
      </div>

      {typeCounts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <p className="text-[13px] font-medium text-ink">Breakdown by action type</p>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {typeCounts.map(([type, count]) => (
              <Badge key={type} tone="neutral">
                {TYPE_LABEL[type] ?? type}: {count}
              </Badge>
            ))}
          </CardBody>
        </Card>
      )}

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
          <Card className="overflow-x-auto">
            <Table className="min-w-[720px] text-[13px]">
              <TableHeader>
                <TableRow className="bg-primary-tint/40 hover:bg-primary-tint/40">
                  <TableHead className="text-muted">Seq</TableHead>
                  <TableHead className="text-muted">Type</TableHead>
                  <TableHead className="text-muted">Prev hash</TableHead>
                  <TableHead className="text-muted">Hash</TableHead>
                  <TableHead className="text-muted">Recorded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const payloadType =
                    entry.payload && typeof entry.payload === "object" && "type" in entry.payload
                      ? String((entry.payload as { type: unknown }).type)
                      : "unknown";
                  return (
                    <TableRow key={entry.seq}>
                      <TableCell className="font-mono-figures tabular-nums text-ink">{entry.seq}</TableCell>
                      <TableCell className="text-ink">{TYPE_LABEL[payloadType] ?? payloadType}</TableCell>
                      <TableCell className="font-mono-figures text-muted">{truncateHash(entry.prevHash)}</TableCell>
                      <TableCell className="font-mono-figures text-muted">{truncateHash(entry.hash)}</TableCell>
                      <TableCell className="text-muted">{new Date(entry.createdAt).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}

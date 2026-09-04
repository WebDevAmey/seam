import { VerifyButton } from "@/components/verify-button";
import { getLedgerEntries } from "@/lib/api";
import { requireDemoMerchantId } from "@/lib/demo-merchant";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export default async function LedgerPage() {
  const merchantId = requireDemoMerchantId();
  const entries = await getLedgerEntries(merchantId);

  return (
    <div className="px-6 py-10 sm:px-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[15px] font-medium">Ledger</h1>
          <p className="mt-2 max-w-[60ch] text-[13px] text-muted">
            Every action this system took, hash-chained from genesis. The chain is global across every
            merchant — this table is filtered to this one for display; verifying recomputes the whole
            thing.
          </p>
        </div>
        <VerifyButton />
      </div>

      <div className="mt-8 overflow-x-auto border-t border-rule">
        {entries.length === 0 && (
          <p className="border-b border-rule py-6 text-[13px] text-muted">
            No ledger entries yet for this merchant.
          </p>
        )}
        {entries.length > 0 && (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-3 pr-4 font-normal">Seq</th>
                <th className="py-3 pr-4 font-normal">Type</th>
                <th className="py-3 pr-4 font-normal">Prev hash</th>
                <th className="py-3 pr-4 font-normal">Hash</th>
                <th className="py-3 font-normal">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const payloadType =
                  entry.payload && typeof entry.payload === "object" && "type" in entry.payload
                    ? String((entry.payload as { type: unknown }).type)
                    : "—";
                return (
                  <tr key={entry.seq} className="border-b border-rule">
                    <td className="font-mono-figures py-3 pr-4 tabular-nums">{entry.seq}</td>
                    <td className="py-3 pr-4">{payloadType}</td>
                    <td className="font-mono-figures py-3 pr-4 text-muted">{truncateHash(entry.prevHash)}</td>
                    <td className="font-mono-figures py-3 pr-4">{truncateHash(entry.hash)}</td>
                    <td className="py-3 text-muted">{new Date(entry.createdAt).toLocaleString("en-IN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use server";

import { verifyLedger, type VerifyResult } from "@/lib/api";

// A Server Action, not a direct client-side fetch to apps/api — that fetch
// would be cross-origin from the browser (localhost:3010 → :8090) and
// blocked by CORS, which apps/api doesn't set up for (every real fetch in
// this app runs server-to-server, deliberately — see lib/api.ts).
export async function verifyLedgerAction(): Promise<VerifyResult> {
  return verifyLedger();
}

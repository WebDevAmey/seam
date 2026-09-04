import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Deterministic JSON: same logical payload, same bytes, regardless of the
 * key order it was constructed in — required for the hash to be a
 * meaningful fingerprint of *content*, not of incidental object shape. */
export function canonicalJson(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload));
}

export function computeEntryHash(prevHash: string, payload: unknown): string {
  return createHash("sha256").update(prevHash + canonicalJson(payload)).digest("hex");
}

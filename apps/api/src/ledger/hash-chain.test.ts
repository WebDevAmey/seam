import { describe, expect, it } from "vitest";
import { computeEntryHash, GENESIS_HASH } from "./hash-chain.js";

describe("computeEntryHash", () => {
  it("is deterministic for the same prevHash and payload", () => {
    const a = computeEntryHash(GENESIS_HASH, { actionId: "a1", verdict: "PASS" });
    const b = computeEntryHash(GENESIS_HASH, { actionId: "a1", verdict: "PASS" });
    expect(a).toBe(b);
  });

  it("is independent of key order — the same logical payload hashes the same way", () => {
    const a = computeEntryHash(GENESIS_HASH, { actionId: "a1", verdict: "PASS" });
    const b = computeEntryHash(GENESIS_HASH, { verdict: "PASS", actionId: "a1" });
    expect(a).toBe(b);
  });

  it("changes if the payload changes even slightly", () => {
    const a = computeEntryHash(GENESIS_HASH, { actionId: "a1", verdict: "PASS" });
    const b = computeEntryHash(GENESIS_HASH, { actionId: "a1", verdict: "BLOCK" });
    expect(a).not.toBe(b);
  });

  it("changes if prevHash changes, even with an identical payload — this is what makes it a chain", () => {
    const a = computeEntryHash(GENESIS_HASH, { actionId: "a1" });
    const b = computeEntryHash("some-other-prev-hash", { actionId: "a1" });
    expect(a).not.toBe(b);
  });

  it("hashes nested objects and arrays consistently regardless of key order", () => {
    const a = computeEntryHash(GENESIS_HASH, { a: 1, nested: { z: 1, y: 2 }, list: [1, 2, 3] });
    const b = computeEntryHash(GENESIS_HASH, { nested: { y: 2, z: 1 }, a: 1, list: [1, 2, 3] });
    expect(a).toBe(b);
  });
});

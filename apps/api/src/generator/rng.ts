/**
 * A small seeded PRNG (mulberry32) — not cryptographic, just deterministic.
 * The eval harness needs two *reproducible* seeded sets (PRD §10: "open the
 * second exactly once"), so `Math.random()` won't do.
 */
export function createRng(seed: number): () => number {
  let state = seed | 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[randomInt(rng, 0, items.length - 1)];
  if (item === undefined) throw new Error("pick() called with an empty array");
  return item;
}

# Notes

A short, factual log — not a narrative (that's `LEARNINGS.md`). Mainly exists to record the one thing that has to be timestamped honestly: when the held-out eval set was opened.

## Held-out set

Seeds: detection `900101`, join `900202`, baselines `900303` (`apps/api/scripts/eval-*.ts heldout`).

**Opened once, 2026-09-04T14:23:52Z.** Full results in `EVALUATION.md`. Summary: detection precision/recall identical to dev (1.000/1.000 on all four classes — expected, the detector's correctness doesn't depend on which random amounts/timestamps the generator drew). Join precision/recall also identical to dev (1.000/0.333) — see the disclosed limitation added to `EVALUATION.md` about why: the eval's scenario *mix* (10 clean / 10 ambiguous / 10 unmatchable / 10 noise) is fixed by construction regardless of seed, so this particular eval script can't actually show seed-to-seed variance in that number, only in the underlying values. Baselines: didn't tie this time — seam's dispatched net (₹8,101.95) came in below blast's (₹9,675.85), but the full explanation (not just the number) is in `EVALUATION.md`.

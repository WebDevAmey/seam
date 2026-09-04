import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Several tests exercise the real Postgres queue (FOR UPDATE SKIP
    // LOCKED) globally, by design — a sweep has to see every merchant's
    // pending work. That means concurrently-running test *files* would
    // compete for the same shared rows if vitest parallelised them; running
    // files serially keeps the suite deterministic instead of scoping the
    // production query down just to make tests convenient.
    fileParallelism: false,
  },
});

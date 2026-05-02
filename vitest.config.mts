import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Single fork, no isolation: tests share one tmp DB and reset between them.
    // better-sqlite3 is synchronous, so this also avoids file-lock contention.
    pool: "forks",
    isolate: false,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

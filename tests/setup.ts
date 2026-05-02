import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each vitest worker gets its own tmp DB. Set BEFORE any module imports `lib/db/client`.
const dir = mkdtempSync(join(tmpdir(), "bare-metals-test-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
// NODE_ENV is typed as readonly by Next's types; vitest doesn't care but tsc does.
(process.env as Record<string, string>).NODE_ENV = "test";

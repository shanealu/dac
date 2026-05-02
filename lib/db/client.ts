import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./bare-metals.db";
const dbFile = url.startsWith("file:") ? url.slice("file:".length) : url;

// Cache the SQLite handle on globalThis in dev so Next's HMR doesn't leak
// connections every reload. Production code paths instantiate once per process.
type Cached = { sqlite: Database.Database; db: ReturnType<typeof drizzle<typeof schema>> };
const globalForDb = globalThis as unknown as { __db?: Cached };

function open(): Cached {
  const sqlite = new Database(dbFile);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

const cached = globalForDb.__db ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__db = cached;

export const db = cached.db;
export const raw = cached.sqlite;

import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./bare-metals.db";
const dbFile = url.startsWith("file:") ? url.slice("file:".length) : url;

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: dbFile },
  strict: true,
  verbose: true,
});

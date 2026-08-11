import { promises as fs } from "node:fs";
import path from "node:path";
import { getPool } from "@/server/db";

async function main(): Promise<void> {
  const files = (await fs.readdir(path.resolve("db/migrations"))).filter((file) => file.endsWith(".sql")).sort();
  const pool = getPool();
  const table = await pool.query<{ name: string }>(`SELECT to_regclass('public.schema_migrations') AS name`);
  if (!table.rows[0]?.name) throw new Error("schema_migrations table is missing; run npm run db:migrate.");
  const applied = new Set((await pool.query<{ name: string }>(`SELECT name FROM schema_migrations ORDER BY name`)).rows.map((row) => row.name));
  const missing = files.filter((file) => !applied.has(file));
  const unknown = [...applied].filter((name) => !files.includes(name));
  if (missing.length || unknown.length) throw new Error(`Migration drift. Missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}.`);
  console.log(`Migration check passed: ${files.length} migration(s) applied.`);
  await pool.end();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });


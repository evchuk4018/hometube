import { promises as fs } from "node:fs";
import path from "node:path";
import { getPool, withTransaction } from "@/server/db";

async function main(): Promise<void> {
  const migrationsDir = path.resolve("db/migrations");
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const pool = getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  for (const file of files) {
    const existing = await pool.query<{ name: string }>(`SELECT name FROM schema_migrations WHERE name = $1`, [file]);
    if (existing.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    });
    console.log(`Applied ${file}`);
  }
  await pool.end();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });


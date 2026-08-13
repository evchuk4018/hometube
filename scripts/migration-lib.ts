import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '@/server/db/client';

export async function migrationFiles(): Promise<string[]> {
  const directory = path.join(process.cwd(), 'migrations');
  return (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
}

export async function ensureMigrationTable(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function appliedMigrations(): Promise<Set<string>> {
  await ensureMigrationTable();
  const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name');
  return new Set(result.rows.map((row) => row.name));
}

export async function applyMigration(name: string): Promise<void> {
  const sql = await readFile(path.join(process.cwd(), 'migrations', name), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalForDatabase = globalThis as unknown as { hometubePool?: Pool };

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required');
  return value;
}

const buildSafeConnectionString = process.env.DATABASE_URL
  ?? 'postgresql://hometube-build:hometube-build@127.0.0.1:1/hometube-build';

export const pool = globalForDatabase.hometubePool ?? new Pool({ connectionString: buildSafeConnectionString });

if (process.env.NODE_ENV !== 'production') globalForDatabase.hometubePool = pool;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

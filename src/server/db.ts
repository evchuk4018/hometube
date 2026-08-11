import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { appConfig, hasDatabase } from "./config";

declare global {
  var __hometubePool: Pool | undefined;
}

export function getPool(): Pool {
  if (!hasDatabase()) throw new Error("DATABASE_URL is not configured.");
  globalThis.__hometubePool ??= new Pool({
    connectionString: appConfig.databaseUrl,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
  return globalThis.__hometubePool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

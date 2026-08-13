import { appliedMigrations, migrationFiles } from './migration-lib';
import { pool } from '@/server/db/client';

async function main(): Promise<void> {
  try {
    const [files, applied] = await Promise.all([migrationFiles(), appliedMigrations()]);
    const pending = files.filter((file) => !applied.has(file));
    if (pending.length > 0) {
      throw new Error(`Pending migrations: ${pending.join(', ')}`);
    }
    console.log(`Migration check passed (${files.length} applied).`);
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

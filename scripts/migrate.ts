import { appliedMigrations, applyMigration, migrationFiles } from './migration-lib';
import { pool } from '@/server/db/client';

async function main(): Promise<void> {
  try {
    const files = await migrationFiles();
    const applied = await appliedMigrations();
    for (const file of files) {
      if (applied.has(file)) continue;
      await applyMigration(file);
      console.log(`Applied ${file}`);
    }
    console.log('Database migrations are current.');
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

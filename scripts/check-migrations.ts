import { appliedMigrations, migrationFiles } from './migration-lib';
import { pool } from '@/server/db/client';

try {
  const [files, applied] = await Promise.all([migrationFiles(), appliedMigrations()]);
  const pending = files.filter((file) => !applied.has(file));
  if (pending.length > 0) {
    console.error(`Pending migrations: ${pending.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Migration check passed (${files.length} applied).`);
  }
} finally {
  await pool.end();
}

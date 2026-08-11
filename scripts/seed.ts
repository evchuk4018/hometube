import { getPool } from "@/server/db";
import { initialChannels } from "@/server/seed/initial-channels";
import { createChannel } from "@/server/repositories/channel-repository";

async function main(): Promise<void> {
  const pool = getPool();
  for (const channel of initialChannels) await createChannel({ ...channel, source: "initial_seed" });
  await pool.query(`INSERT INTO app_config (key, value) VALUES ('media_policy', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify({ maxBytes: 137438953472, maxHeight: 720 })]);
  console.log(`Seeded ${initialChannels.length} initial channels.`);
  await pool.end();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });


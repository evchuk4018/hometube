import { getPool } from "@/server/db";
import { removeObsoleteInitialSeedChannels, createChannel } from "@/server/repositories/channel-repository";
import { initialChannels } from "@/server/seed/initial-channels";

async function main(): Promise<void> {
  const pool = getPool();
  const removed = await removeObsoleteInitialSeedChannels(initialChannels.map((channel) => channel.providerId));
  for (const channel of initialChannels) await createChannel({ ...channel, source: "initial_seed" });
  await pool.query(`INSERT INTO app_config (key, value) VALUES ('media_policy', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify({ maxBytes: 137438953472, maxHeight: 720 })]);
  console.log(`Seeded ${initialChannels.length} initial channels and removed ${removed} obsolete initial channels.`);
  await pool.end();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

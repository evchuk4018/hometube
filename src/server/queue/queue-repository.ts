import { query } from '@/server/db/client';

export async function getQueueVideoIds(): Promise<string[]> {
  const rows = await query<{ video_ids: string[] }>(`
    SELECT video_ids FROM autoplay_queues WHERE id = 1
  `);
  return rows[0]?.video_ids ?? [];
}

export async function replaceQueue(videoIds: string[]): Promise<void> {
  await query(`
    INSERT INTO autoplay_queues (id, video_ids, updated_at)
    VALUES (1, $1, now())
    ON CONFLICT (id) DO UPDATE SET
      video_ids = EXCLUDED.video_ids,
      updated_at = now()
  `, [videoIds]);
}

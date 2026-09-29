import { query } from '@/server/db/client';

export type PersistedQueue = {
  videoIds: string[];
  excludedChannelIds: string[];
};

export async function getQueueState(): Promise<PersistedQueue> {
  const rows = await query<{ video_ids: string[]; excluded_channel_ids: string[] }>(`
    SELECT video_ids, excluded_channel_ids FROM autoplay_queues WHERE id = 1
  `);
  return {
    videoIds: rows[0]?.video_ids ?? [],
    excludedChannelIds: rows[0]?.excluded_channel_ids ?? []
  };
}

export async function replaceQueue(videoIds: string[], excludedChannelIds: string[]): Promise<void> {
  await query(`
    INSERT INTO autoplay_queues (id, video_ids, excluded_channel_ids, updated_at)
    VALUES (1, $1, $2, now())
    ON CONFLICT (id) DO UPDATE SET
      video_ids = EXCLUDED.video_ids,
      excluded_channel_ids = EXCLUDED.excluded_channel_ids,
      updated_at = now()
  `, [videoIds, [...new Set(excludedChannelIds)]]);
}

import { query } from '@/server/db/client';

export type PersistedQueue = {
  videoIds: string[];
  excludedChannelIds: string[];
  currentVideoId: string | null;
};

export async function getQueueState(): Promise<PersistedQueue> {
  const rows = await query<{ video_ids: string[]; excluded_channel_ids: string[]; current_video_id: string | null }>(`
    SELECT video_ids, excluded_channel_ids,
      (SELECT video_id FROM playback_sessions WHERE id = 1) AS current_video_id
    FROM autoplay_queues WHERE id = 1
  `);
  return {
    videoIds: rows[0]?.video_ids ?? [],
    excludedChannelIds: rows[0]?.excluded_channel_ids ?? [],
    currentVideoId: rows[0]?.current_video_id ?? null
  };
}

export async function getSubscribedQueueChannelIds(channelIds: string[]): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set();
  const rows = await query<{ id: string }>(`
    SELECT id FROM channels
    WHERE id = ANY($1::uuid[]) AND is_subscribed = true
  `, [[...new Set(channelIds)]]);
  return new Set(rows.map((row) => row.id));
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

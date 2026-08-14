import type { PoolClient } from 'pg';
import { query } from '@/server/db/client';

export async function getCurrentVideoId(): Promise<string | null> {
  const rows = await query<{ video_id: string }>(`
    SELECT s.video_id
    FROM playback_sessions s
    JOIN videos v ON v.id = s.video_id
    WHERE s.id = 1 AND v.watch_state <> 'watched'
  `);
  return rows[0]?.video_id ?? null;
}

export async function setCurrentVideo(client: PoolClient, videoId: string): Promise<void> {
  await client.query(`
    INSERT INTO playback_sessions (id, video_id, updated_at)
    VALUES (1, $1, now())
    ON CONFLICT (id) DO UPDATE SET
      video_id = EXCLUDED.video_id,
      updated_at = now()
  `, [videoId]);
}

export async function clearCurrentVideoIfMatching(client: PoolClient, videoId: string): Promise<void> {
  await client.query(`
    DELETE FROM playback_sessions
    WHERE id = 1 AND video_id = $1
  `, [videoId]);
}

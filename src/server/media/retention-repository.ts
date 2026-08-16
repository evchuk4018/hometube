import type { PoolClient } from 'pg';
import { query, transaction } from '@/server/db/client';

export type EvictionTarget = {
  videoId: string;
  relativePath: string;
  audioRelativePath: string | null;
  sizeBytes: number;
  audioSizeBytes: number;
};

type EvictionRow = {
  video_id: string;
  relative_path: string;
  audio_relative_path: string | null;
  size_bytes: string;
  audio_size_bytes: string | null;
};

const EXEMPT_FROM_EVICTION = `
  AND NOT EXISTS (SELECT 1 FROM playback_sessions ps WHERE ps.id = 1 AND ps.video_id = m.video_id)
  AND NOT EXISTS (SELECT 1 FROM autoplay_queues aq WHERE aq.id = 1 AND m.video_id = ANY(aq.video_ids))
`;

const evictionSelect = `
  SELECT m.video_id, m.relative_path, m.audio_relative_path, m.size_bytes::text,
    m.audio_size_bytes::text
  FROM media_files m
  JOIN videos v ON v.id = m.video_id
`;

function mapEvictionTarget(row: EvictionRow): EvictionTarget {
  return {
    videoId: row.video_id,
    relativePath: row.relative_path,
    audioRelativePath: row.audio_relative_path,
    sizeBytes: Number(row.size_bytes),
    audioSizeBytes: Number(row.audio_size_bytes ?? 0)
  };
}

export async function getTotalMediaBytes(): Promise<number> {
  const rows = await query<{ total: string }>(`
    SELECT coalesce(sum(size_bytes + coalesce(audio_size_bytes, 0)), 0)::text AS total
    FROM media_files
  `);
  return Number(rows[0]?.total ?? 0);
}

export async function listRetentionCandidates(cutoff: Date): Promise<EvictionTarget[]> {
  const rows = await query<EvictionRow>(`
    ${evictionSelect}
    WHERE (
      (v.last_watched_at IS NOT NULL AND v.last_watched_at < $1)
      OR (v.last_watched_at IS NULL AND m.created_at < $1)
    )
    ${EXEMPT_FROM_EVICTION}
    ORDER BY COALESCE(v.last_watched_at, m.created_at) ASC, m.created_at ASC
  `, [cutoff]);
  return rows.map(mapEvictionTarget);
}

export async function listStorageCapCandidates(limit: number): Promise<EvictionTarget[]> {
  const rows = await query<EvictionRow>(`
    ${evictionSelect}
    WHERE 1 = 1
    ${EXEMPT_FROM_EVICTION}
    ORDER BY v.last_watched_at ASC NULLS FIRST, m.created_at ASC
    LIMIT $1
  `, [limit]);
  return rows.map(mapEvictionTarget);
}

export async function deleteMediaRow(client: PoolClient, videoId: string): Promise<EvictionTarget | null> {
  const guarded = await client.query<{ video_id: string }>(`
    SELECT m.video_id
    FROM media_files m
    WHERE m.video_id = $1
      AND NOT EXISTS (SELECT 1 FROM playback_sessions ps WHERE ps.id = 1 AND ps.video_id = m.video_id)
      AND NOT EXISTS (SELECT 1 FROM autoplay_queues aq WHERE aq.id = 1 AND m.video_id = ANY(aq.video_ids))
    FOR UPDATE
  `, [videoId]);
  if (!guarded.rows[0]) return null;
  const rows = await client.query<EvictionRow>(`
    DELETE FROM media_files
    WHERE video_id = $1
    RETURNING video_id, relative_path, audio_relative_path, size_bytes::text, audio_size_bytes::text
  `, [videoId]);
  await client.query(`
    UPDATE videos SET media_status = 'not_downloaded', media_error = NULL, updated_at = now()
    WHERE id = $1
  `, [videoId]);
  return rows.rows[0] ? mapEvictionTarget(rows.rows[0]) : null;
}

export async function evictVideo(videoId: string): Promise<EvictionTarget | null> {
  return transaction(async (client) => deleteMediaRow(client, videoId));
}

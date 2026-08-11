import type { EvictionCandidate, MediaFile, MediaState } from "@/domain/types";
import { query } from "../db";
import { mapMediaRow } from "../row-mappers";

export async function findReadyMedia(videoId: string): Promise<MediaFile | null> {
  const result = await query<Record<string, unknown>>(
    `SELECT id AS media_id, video_id, path AS media_path, bytes AS media_bytes, height AS media_height,
      mime_type AS media_mime_type, state AS media_state, downloaded_at AS media_downloaded_at,
      last_accessed_at AS media_last_accessed_at
     FROM media_files WHERE video_id = $1 AND state = 'ready'`,
    [videoId]
  );
  return result.rows[0] ? mapMediaRow(result.rows[0]) : null;
}

export async function queueMediaDownload(videoId: string): Promise<void> {
  await query(
    `INSERT INTO download_jobs (video_id, kind, status) VALUES ($1, 'manual', 'queued')
     ON CONFLICT (video_id) WHERE status IN ('queued', 'downloading') DO NOTHING`,
    [videoId]
  );
}

export async function markMediaState(videoId: string, state: MediaState, details?: { path?: string; bytes?: number; height?: number; mimeType?: string; error?: string }): Promise<void> {
  await query(
    `INSERT INTO media_files (video_id, path, bytes, height, mime_type, state, error_message, downloaded_at, last_accessed_at)
     VALUES ($1, COALESCE($2, ''), COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 'video/mp4'), $6, $7,
       CASE WHEN $6 = 'ready' THEN now() ELSE NULL END, CASE WHEN $6 = 'ready' THEN now() ELSE NULL END)
     ON CONFLICT (video_id) DO UPDATE SET path = COALESCE(NULLIF(EXCLUDED.path, ''), media_files.path),
       bytes = CASE WHEN $6 = 'ready' THEN EXCLUDED.bytes ELSE media_files.bytes END,
       height = CASE WHEN $6 = 'ready' THEN EXCLUDED.height ELSE media_files.height END,
       mime_type = COALESCE(EXCLUDED.mime_type, media_files.mime_type), state = $6,
       error_message = EXCLUDED.error_message,
       downloaded_at = CASE WHEN $6 = 'ready' THEN now() ELSE media_files.downloaded_at END,
       last_accessed_at = CASE WHEN $6 = 'ready' THEN now() ELSE media_files.last_accessed_at END,
       updated_at = now()`,
    [videoId, details?.path ?? null, details?.bytes ?? null, details?.height ?? null, details?.mimeType ?? null, state, details?.error ?? null]
  );
}

export async function markMediaAccessed(videoId: string): Promise<void> {
  await query(`UPDATE media_files SET last_accessed_at = now(), updated_at = now() WHERE video_id = $1 AND state = 'ready'`, [videoId]);
}

export async function deleteMediaRecord(videoId: string): Promise<MediaFile | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE media_files SET state = 'deleted', updated_at = now() WHERE video_id = $1 AND state = 'ready'
     RETURNING id AS media_id, video_id, path AS media_path, bytes AS media_bytes, height AS media_height, mime_type AS media_mime_type, state AS media_state, downloaded_at AS media_downloaded_at, last_accessed_at AS media_last_accessed_at`,
    [videoId]
  );
  return result.rows[0] ? mapMediaRow(result.rows[0]) : null;
}

export async function currentMediaBytes(): Promise<number> {
  const result = await query<{ total: string }>(`SELECT COALESCE(SUM(bytes), 0)::text AS total FROM media_files WHERE state = 'ready'`);
  return Number(result.rows[0]?.total ?? 0);
}

export async function listEvictionCandidates(): Promise<EvictionCandidate[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT m.id AS media_id, m.video_id, m.bytes, v.watch_state, c.is_podcast,
      (c.is_podcast AND v.watch_state IN ('unwatched', 'in_progress')) AS is_podcast_protected,
      v.is_pinned, c.is_pruned, v.is_trial, v.is_ignored, v.recommendation_score, m.last_accessed_at
     FROM media_files m JOIN videos v ON v.id = m.video_id JOIN channels c ON c.id = v.channel_id
     WHERE m.state = 'ready'`
  );
  return result.rows.map((row) => ({
    mediaId: String(row.media_id),
    videoId: String(row.video_id),
    bytes: Number(row.bytes),
    watchState: row.watch_state as EvictionCandidate["watchState"],
    isPodcast: row.is_podcast === true,
    isPodcastProtected: row.is_podcast_protected === true,
    isPinned: row.is_pinned === true,
    channelPruned: row.is_pruned === true,
    isTrial: row.is_trial === true,
    isIgnored: row.is_ignored === true,
    recommendationScore: Number(row.recommendation_score ?? 0),
    lastAccessedAt: row.last_accessed_at ? new Date(String(row.last_accessed_at)).toISOString() : null
  }));
}

export async function listCompletedPodcastMedia(): Promise<EvictionCandidate[]> {
  const candidates = await listEvictionCandidates();
  return candidates.filter((candidate) => candidate.isPodcast && candidate.watchState === "watched");
}

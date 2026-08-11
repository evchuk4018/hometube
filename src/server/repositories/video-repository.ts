import type { ProviderVideo, Video } from "@/domain/types";
import { query } from "../db";
import { mapVideoRow } from "../row-mappers";

const videoSelect = `
  v.id AS video_id, v.provider_id, v.channel_id, c.name AS channel_name, v.title,
  v.description, v.thumbnail_url, v.published_at, v.duration_seconds,
  v.view_count, v.watch_state, v.progress_seconds, v.watch_percentage,
  v.is_trial, v.is_ignored, v.is_pinned, v.recommendation_score, c.is_podcast,
  m.id AS media_id, m.video_id AS media_video_id, m.path AS media_path,
  m.bytes AS media_bytes, m.height AS media_height, m.mime_type AS media_mime_type,
  m.state AS media_state, m.downloaded_at AS media_downloaded_at,
  m.last_accessed_at AS media_last_accessed_at
`;

export type FeedVideoRow = Record<string, unknown> & {
  channel_videos_presented: number;
  channel_videos_opened: number;
  channel_videos_watched: number;
  channel_average_percentage_watched: number;
  channel_recent_engagement: number;
  channel_last_interaction_at: string | null;
  channel_is_retained: boolean;
  channel_is_pinned: boolean;
  channel_is_pruned: boolean;
  channel_source: string;
};

export async function listFeedVideoRows(limit = 500): Promise<FeedVideoRow[]> {
  const result = await query<FeedVideoRow>(
    `SELECT ${videoSelect}, c.videos_presented AS channel_videos_presented,
      c.videos_opened AS channel_videos_opened, c.videos_watched AS channel_videos_watched,
      c.average_percentage_watched AS channel_average_percentage_watched,
      c.recent_engagement AS channel_recent_engagement,
      c.last_interaction_at AS channel_last_interaction_at,
      c.is_retained AS channel_is_retained, c.is_pinned AS channel_is_pinned,
      c.is_pruned AS channel_is_pruned, c.source AS channel_source
     FROM videos v JOIN channels c ON c.id = v.channel_id
     LEFT JOIN media_files m ON m.video_id = v.id
     WHERE v.is_ignored = false AND c.is_pruned = false
     ORDER BY v.published_at DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function listVideosByChannel(channelId: string, limit = 200): Promise<Video[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT ${videoSelect} FROM videos v JOIN channels c ON c.id = v.channel_id
     LEFT JOIN media_files m ON m.video_id = v.id
     WHERE v.channel_id = $1 ORDER BY v.published_at DESC NULLS LAST, v.view_count DESC NULLS LAST LIMIT $2`,
    [channelId, limit]
  );
  return result.rows.map(mapVideoRow);
}

export async function listPodcastEpisodes(limit = 300): Promise<Video[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT ${videoSelect} FROM videos v JOIN channels c ON c.id = v.channel_id
     LEFT JOIN media_files m ON m.video_id = v.id
     WHERE c.is_podcast = true ORDER BY v.published_at DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapVideoRow);
}

export async function findVideoById(id: string): Promise<Video | null> {
  const result = await query<Record<string, unknown>>(`SELECT ${videoSelect} FROM videos v JOIN channels c ON c.id = v.channel_id LEFT JOIN media_files m ON m.video_id = v.id WHERE v.id = $1`, [id]);
  return result.rows[0] ? mapVideoRow(result.rows[0]) : null;
}

export async function findVideoByProviderId(providerId: string): Promise<Video | null> {
  const result = await query<Record<string, unknown>>(`SELECT ${videoSelect} FROM videos v JOIN channels c ON c.id = v.channel_id LEFT JOIN media_files m ON m.video_id = v.id WHERE v.provider_id = $1`, [providerId]);
  return result.rows[0] ? mapVideoRow(result.rows[0]) : null;
}

export async function upsertVideo(channelId: string, incoming: ProviderVideo): Promise<Video> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO videos (channel_id, provider_id, title, description, thumbnail_url, published_at, duration_seconds, view_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (provider_id) DO UPDATE SET
       channel_id = EXCLUDED.channel_id, title = EXCLUDED.title,
       description = COALESCE(EXCLUDED.description, videos.description),
       thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, videos.thumbnail_url),
       published_at = COALESCE(EXCLUDED.published_at, videos.published_at),
       duration_seconds = CASE WHEN EXCLUDED.duration_seconds > 0 THEN EXCLUDED.duration_seconds ELSE videos.duration_seconds END,
       view_count = COALESCE(EXCLUDED.view_count, videos.view_count), updated_at = now()
     RETURNING id`,
    [channelId, incoming.providerId, incoming.title, incoming.description ?? null, incoming.thumbnailUrl ?? null, incoming.publishedAt ? new Date(incoming.publishedAt) : null, incoming.durationSeconds, incoming.viewCount ?? null]
  );
  const video = await findVideoById(String(result.rows[0].id));
  if (!video) throw new Error("Video was inserted but could not be read back.");
  return video;
}

export async function updateVideoProgress(input: { id: string; state: Video["watchState"]; positionSeconds: number; watchPercentage: number }): Promise<Video | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE videos SET watch_state = $2, progress_seconds = $3, watch_percentage = $4,
       watched_at = CASE WHEN $2 = 'watched' THEN COALESCE(watched_at, now()) ELSE NULL END,
       last_interaction_at = now(), updated_at = now() WHERE id = $1 RETURNING id`,
    [input.id, input.state, input.positionSeconds, input.watchPercentage]
  );
  return result.rows[0] ? findVideoById(String(result.rows[0].id)) : null;
}

export async function updateVideoPinned(id: string, pinned: boolean): Promise<Video | null> {
  const result = await query<Record<string, unknown>>(`UPDATE videos SET is_pinned = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, pinned]);
  return result.rows[0] ? findVideoById(String(result.rows[0].id)) : null;
}

export async function setVideoIgnored(id: string, ignored: boolean): Promise<void> {
  await query(`UPDATE videos SET is_ignored = $2, updated_at = now() WHERE id = $1`, [id, ignored]);
}

export async function setVideoTrial(id: string, trial: boolean): Promise<void> {
  await query(`UPDATE videos SET is_trial = $2, updated_at = now() WHERE id = $1`, [id, trial]);
}

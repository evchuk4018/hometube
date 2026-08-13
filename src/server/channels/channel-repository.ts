import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, transaction } from '@/server/db/client';
import type { ChannelSummary, VideoSummary } from '@/protocol/schemas';

type ChannelRow = {
  id: string;
  youtube_channel_id: string | null;
  source_url: string;
  name: string;
  handle: string | null;
  thumbnail_url: string | null;
  import_status: ChannelSummary['importStatus'];
  import_error: string | null;
  video_count: string;
  ready_count: string;
};

type VideoRow = {
  id: string;
  channel_id: string;
  channel_name: string;
  title: string;
  duration_seconds: number | null;
  upload_date: string | null;
  view_count: string | null;
  thumbnail_url: string | null;
  web_url: string;
  availability: string;
  live_status: string | null;
  media_status: VideoSummary['mediaStatus'];
  media_error: string | null;
  has_background_audio: boolean;
};

function mapChannel(row: ChannelRow): ChannelSummary {
  return {
    id: row.id,
    youtubeChannelId: row.youtube_channel_id,
    sourceUrl: row.source_url,
    name: row.name,
    handle: row.handle,
    thumbnailUrl: row.thumbnail_url,
    importStatus: row.import_status,
    importError: row.import_error,
    videoCount: Number(row.video_count),
    readyCount: Number(row.ready_count)
  };
}

function mapVideo(row: VideoRow): VideoSummary {
  const live = row.live_status === 'is_live' || row.live_status === 'is_upcoming';
  const unavailable = ['private', 'premium_only', 'subscriber_only', 'unavailable'].includes(row.availability);
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    title: row.title,
    durationSeconds: row.duration_seconds,
    uploadDate: row.upload_date,
    viewCount: row.view_count === null ? null : Number(row.view_count),
    thumbnailUrl: row.thumbnail_url,
    webUrl: row.web_url,
    availability: row.availability,
    liveStatus: row.live_status,
    mediaStatus: row.media_status,
    mediaError: row.media_error,
    hasBackgroundAudio: row.has_background_audio,
    downloadable: !live && !unavailable
  };
}

const channelSelect = `
  SELECT c.id, c.youtube_channel_id, c.source_url, c.name, c.handle, c.thumbnail_url,
    c.import_status, c.import_error,
    count(v.id)::text AS video_count,
    count(v.id) FILTER (WHERE v.media_status = 'ready')::text AS ready_count
  FROM channels c
  LEFT JOIN videos v ON v.channel_id = c.id
`;

export async function replaceSearchChannel(sourceUrl: string, name: string): Promise<ChannelSummary> {
  await transaction(async (client) => {
    await client.query('DELETE FROM channels');
    await client.query(`
      INSERT INTO channels (id, source_url, name)
      VALUES ($1, $2, $3)
    `, [randomUUID(), sourceUrl, name]);
  });
  const channel = await getChannel(sourceUrl, 'source_url');
  if (!channel) throw new Error('Channel was not created');
  return channel;
}

export async function getChannel(value: string, field: 'id' | 'source_url' = 'id'): Promise<ChannelSummary | null> {
  const rows = await query<ChannelRow>(`${channelSelect} WHERE c.${field} = $1 GROUP BY c.id`, [value]);
  return rows[0] ? mapChannel(rows[0]) : null;
}

export async function listChannelVideos(channelId: string, limit = 50, offset = 0): Promise<VideoSummary[]> {
  const rows = await query<VideoRow>(`
    SELECT v.id, v.channel_id, c.name AS channel_name, v.title, v.duration_seconds,
      v.upload_date::text, v.view_count::text, v.thumbnail_url, v.web_url,
      v.availability, v.live_status, v.media_status, v.media_error,
      (m.audio_relative_path IS NOT NULL) AS has_background_audio
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    LEFT JOIN media_files m ON m.video_id = v.id
    WHERE v.channel_id = $1
    ORDER BY v.upload_date DESC NULLS LAST, v.created_at DESC, v.id DESC
    LIMIT $2 OFFSET $3
  `, [channelId, limit, offset]);
  return rows.map(mapVideo);
}

export async function getVideo(videoId: string): Promise<VideoSummary | null> {
  const rows = await query<VideoRow>(`
    SELECT v.id, v.channel_id, c.name AS channel_name, v.title, v.duration_seconds,
      v.upload_date::text, v.view_count::text, v.thumbnail_url, v.web_url,
      v.availability, v.live_status, v.media_status, v.media_error,
      (m.audio_relative_path IS NOT NULL) AS has_background_audio
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    LEFT JOIN media_files m ON m.video_id = v.id
    WHERE v.id = $1
  `, [videoId]);
  return rows[0] ? mapVideo(rows[0]) : null;
}

export type ImportedChannel = {
  youtubeChannelId: string | null;
  name: string | null;
  handle: string | null;
  thumbnailUrl: string | null;
};

export type ImportedVideo = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  uploadDate: string | null;
  viewCount: number | null;
  thumbnailUrl: string | null;
  webUrl: string;
  availability: string;
  liveStatus: string | null;
};

export async function updateImportedChannel(client: PoolClient, channelId: string, data: ImportedChannel): Promise<void> {
  await client.query(`
    UPDATE channels SET
      youtube_channel_id = COALESCE($2, youtube_channel_id),
      name = COALESCE($3, name), handle = COALESCE($4, handle),
      thumbnail_url = COALESCE($5, thumbnail_url), import_status = 'importing',
      import_error = NULL, updated_at = now()
    WHERE id = $1
  `, [channelId, data.youtubeChannelId, data.name, data.handle, data.thumbnailUrl]);
}

export async function upsertImportedVideo(client: PoolClient, channelId: string, video: ImportedVideo): Promise<void> {
  await client.query(`
    INSERT INTO videos (
      id, channel_id, title, description, duration_seconds, upload_date, view_count,
      thumbnail_url, web_url, availability, live_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      channel_id = EXCLUDED.channel_id, title = EXCLUDED.title,
      description = COALESCE(EXCLUDED.description, videos.description),
      duration_seconds = COALESCE(EXCLUDED.duration_seconds, videos.duration_seconds),
      upload_date = COALESCE(EXCLUDED.upload_date, videos.upload_date),
      view_count = COALESCE(EXCLUDED.view_count, videos.view_count),
      thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, videos.thumbnail_url),
      web_url = EXCLUDED.web_url, availability = EXCLUDED.availability,
      live_status = EXCLUDED.live_status, updated_at = now()
  `, [
    video.id, channelId, video.title, video.description, video.durationSeconds, video.uploadDate,
    video.viewCount, video.thumbnailUrl, video.webUrl, video.availability, video.liveStatus
  ]);
}

export async function setChannelImportState(
  channelId: string,
  status: ChannelSummary['importStatus'],
  error: string | null = null
): Promise<void> {
  await query(`
    UPDATE channels SET import_status = $2, import_error = $3,
      last_imported_at = CASE WHEN $2 = 'ready' THEN now() ELSE last_imported_at END,
      updated_at = now() WHERE id = $1
  `, [channelId, status, error]);
}

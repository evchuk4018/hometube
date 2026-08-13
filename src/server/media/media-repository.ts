import { query } from '@/server/db/client';

export type MediaAsset = {
  videoId: string;
  relativePath: string;
  sizeBytes: number;
  contentType: string;
};

export type MediaAssetKind = 'video' | 'audio';

type MediaRow = {
  video_id: string;
  relative_path: string;
  size_bytes: string;
  content_type: string;
  audio_relative_path: string | null;
  audio_size_bytes: string | null;
  audio_content_type: string | null;
};

export async function getMediaAsset(videoId: string, kind: MediaAssetKind): Promise<MediaAsset | null> {
  const rows = await query<MediaRow>(`
    SELECT video_id, relative_path, size_bytes::text, content_type,
      audio_relative_path, audio_size_bytes::text, audio_content_type
    FROM media_files WHERE video_id = $1
  `, [videoId]);
  const row = rows[0];
  if (!row) return null;
  if (kind === 'audio') {
    if (!row.audio_relative_path || row.audio_size_bytes === null || !row.audio_content_type) return null;
    return {
      videoId: row.video_id,
      relativePath: row.audio_relative_path,
      sizeBytes: Number(row.audio_size_bytes),
      contentType: row.audio_content_type
    };
  }
  return {
    videoId: row.video_id,
    relativePath: row.relative_path,
    sizeBytes: Number(row.size_bytes),
    contentType: row.content_type
  };
}

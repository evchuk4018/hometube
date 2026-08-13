import { query } from '@/server/db/client';

export type MediaFile = {
  videoId: string;
  relativePath: string;
  sizeBytes: number;
  contentType: string;
};

type MediaRow = { video_id: string; relative_path: string; size_bytes: string; content_type: string };

export async function getMediaFile(videoId: string): Promise<MediaFile | null> {
  const rows = await query<MediaRow>('SELECT video_id, relative_path, size_bytes::text, content_type FROM media_files WHERE video_id = $1', [videoId]);
  const row = rows[0];
  return row ? { videoId: row.video_id, relativePath: row.relative_path, sizeBytes: Number(row.size_bytes), contentType: row.content_type } : null;
}

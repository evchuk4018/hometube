import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from '@/server/db/client';
import { extractBackgroundAudio } from '@/server/media/background-audio';
import { mediaCodecs, probeMedia } from '@/server/media/media-probe';
import { resolveMediaPath } from '@/server/media/media-path';

type BackfillRow = {
  video_id: string;
  relative_path: string;
};

async function backfill(row: BackfillRow): Promise<void> {
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(row.video_id)) throw new Error(`Invalid video ID ${row.video_id}`);
  const sourcePath = resolveMediaPath(row.relative_path);
  const sourceStat = await stat(sourcePath).catch(() => null);
  if (!sourceStat?.isFile()) throw new Error(`Source media is missing for ${row.video_id}`);

  const sourceStreams = mediaCodecs(await probeMedia(sourcePath));
  if (!sourceStreams.audio) {
    await query('UPDATE media_files SET audio_codec = NULL WHERE video_id = $1', [row.video_id]);
    console.log(`Skipped ${row.video_id}: source has no audio track`);
    return;
  }

  const audioRelativePath = `videos/${row.video_id}.m4a`;
  const audioPath = resolveMediaPath(audioRelativePath);
  const stagingPath = resolveMediaPath(`videos/.${row.video_id}.${process.pid}.backfill.part.m4a`);
  await mkdir(path.dirname(audioPath), { recursive: true });
  try {
    const audioSizeBytes = await extractBackgroundAudio(sourcePath, stagingPath);
    await rename(stagingPath, audioPath);
    await query(`
      UPDATE media_files SET
        audio_relative_path = $2,
        audio_size_bytes = $3,
        audio_content_type = 'audio/mp4'
      WHERE video_id = $1
    `, [row.video_id, audioRelativePath, audioSizeBytes]);
    console.log(`Prepared background audio for ${row.video_id}`);
  } finally {
    await rm(stagingPath, { force: true }).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  try {
    const rows = await query<BackfillRow>(`
      SELECT video_id, relative_path
      FROM media_files
      WHERE audio_codec IS NOT NULL AND audio_relative_path IS NULL
      ORDER BY created_at, video_id
    `);
    const failures: string[] = [];
    for (const row of rows) {
      try {
        await backfill(row);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Unable to prepare ${row.video_id}: ${message}`);
        failures.push(row.video_id);
      }
    }
    if (failures.length > 0) throw new Error(`Background audio backfill failed for ${failures.length} video(s).`);
    console.log(`Background audio backfill complete (${rows.length} candidate(s)).`);
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

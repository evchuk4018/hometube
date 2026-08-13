import { transaction, query } from '@/server/db/client';
import { getChannel, setChannelImportState, updateImportedChannel, upsertImportedVideo } from '@/server/channels/channel-repository';
import { completeJob, updateJobProgress, type ClaimedJob } from '@/server/jobs/job-repository';
import { importChannelCatalog } from '@/server/youtube/yt-dlp-adapter';
import { downloadVideo } from '@/server/media/download-adapter';

export async function handleJob(job: ClaimedJob): Promise<void> {
  if (job.type === 'import_channel') return handleChannelImport(job);
  return handleVideoDownload(job);
}

async function handleChannelImport(job: ClaimedJob): Promise<void> {
  if (!job.channelId) throw new Error('Import job has no channel.');
  const channel = await getChannel(job.channelId);
  if (!channel) throw new Error('Channel no longer exists.');
  await setChannelImportState(channel.id, 'importing');

  const count = await importChannelCatalog(channel.sourceUrl, async (entry, importedCount) => {
    await transaction(async (client) => {
      await updateImportedChannel(client, channel.id, entry.channel);
      await upsertImportedVideo(client, channel.id, entry.video);
    });
    if (importedCount === 1 || importedCount % 10 === 0) {
      const approximateProgress = Math.min(95, 5 + (importedCount / (importedCount + 100)) * 90);
      await updateJobProgress(job.id, approximateProgress, `Found ${importedCount} videos`);
    }
  });

  if (count === 0) throw new Error('No public videos were found for this channel.');
  await setChannelImportState(channel.id, 'ready');
  await completeJob(job.id, `Found ${count} videos`);
}

async function handleVideoDownload(job: ClaimedJob): Promise<void> {
  if (!job.videoId) throw new Error('Download job has no video.');
  await query(`UPDATE videos SET media_status = 'downloading', media_error = NULL, updated_at = now() WHERE id = $1`, [job.videoId]);
  const media = await downloadVideo(job.id, job.videoId, (progress, stage) => updateJobProgress(job.id, progress, stage));
  await transaction(async (client) => {
    await client.query(`
      INSERT INTO media_files (video_id, relative_path, size_bytes, content_type, width, height, video_codec, audio_codec)
      VALUES ($1, $2, $3, 'video/mp4', $4, $5, $6, $7)
      ON CONFLICT (video_id) DO UPDATE SET
        relative_path = EXCLUDED.relative_path, size_bytes = EXCLUDED.size_bytes,
        content_type = EXCLUDED.content_type, width = EXCLUDED.width, height = EXCLUDED.height,
        video_codec = EXCLUDED.video_codec, audio_codec = EXCLUDED.audio_codec, created_at = now()
    `, [job.videoId, media.relativePath, media.sizeBytes, media.width, media.height, media.videoCodec, media.audioCodec]);
    await client.query(`UPDATE videos SET media_status = 'ready', media_error = NULL, updated_at = now() WHERE id = $1`, [job.videoId]);
  });
  await completeJob(job.id, 'Ready to play');
}

export async function reflectJobFailure(job: ClaimedJob, message: string): Promise<void> {
  const finalFailure = job.attemptCount >= 3;
  if (job.type === 'import_channel' && job.channelId) {
    await setChannelImportState(job.channelId, finalFailure ? 'failed' : 'queued', finalFailure ? message : null);
  }
  if (job.type === 'download_video' && job.videoId) {
    await query(`
      UPDATE videos SET media_status = $2, media_error = $3, updated_at = now() WHERE id = $1
    `, [job.videoId, finalFailure ? 'failed' : 'queued', finalFailure ? message : null]);
  }
}


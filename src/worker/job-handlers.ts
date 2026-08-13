import { transaction, query } from '@/server/db/client';
import { getChannel, pruneImportedCatalog, setChannelImportState, updateImportedChannel, upsertImportedVideo } from '@/server/channels/channel-repository';
import { completeJob, updateJobProgress, type ClaimedJob } from '@/server/jobs/job-repository';
import { importChannelCatalog } from '@/server/youtube/yt-dlp-adapter';
import { downloadVideo } from '@/server/media/download-adapter';
import { runChannelDiscovery } from '@/server/discovery/discovery-service';

export async function handleJob(job: ClaimedJob): Promise<void> {
  if (job.type === 'import_channel') return handleChannelImport(job);
  if (job.type === 'discover_channels') return handleChannelDiscovery(job);
  return handleVideoDownload(job);
}

async function handleChannelImport(job: ClaimedJob): Promise<void> {
  if (!job.channelId) throw new Error('Import job has no channel.');
  const channel = await getChannel(job.channelId);
  if (!channel) throw new Error('Channel no longer exists.');
  await setChannelImportState(channel.id, 'importing');

  const count = await importChannelCatalog(channel.sourceUrl, channel.source, channel.subscribed, async (entry, importedCount) => {
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
  await transaction(async (client) => {
    await pruneImportedCatalog(client, channel.id, channel.source, channel.subscribed);
  });
  await setChannelImportState(channel.id, 'ready');
  await completeJob(job.id, `Found ${count} videos`);
}

async function handleChannelDiscovery(job: ClaimedJob): Promise<void> {
  await updateJobProgress(job.id, 10, 'Finding channels');
  const count = await runChannelDiscovery();
  await completeJob(job.id, `Added ${count} trial channels`);
}

async function handleVideoDownload(job: ClaimedJob): Promise<void> {
  if (!job.videoId) throw new Error('Download job has no video.');
  await query(`UPDATE videos SET media_status = 'downloading', media_error = NULL, updated_at = now() WHERE id = $1`, [job.videoId]);
  const media = await downloadVideo(job.id, job.videoId, (progress, stage) => updateJobProgress(job.id, progress, stage));
  await transaction(async (client) => {
    await client.query(`
      INSERT INTO media_files (
        video_id, relative_path, size_bytes, content_type, width, height, video_codec, audio_codec,
        audio_relative_path, audio_size_bytes, audio_content_type
      )
      VALUES ($1, $2, $3, 'video/mp4', $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (video_id) DO UPDATE SET
        relative_path = EXCLUDED.relative_path, size_bytes = EXCLUDED.size_bytes,
        content_type = EXCLUDED.content_type, width = EXCLUDED.width, height = EXCLUDED.height,
        video_codec = EXCLUDED.video_codec, audio_codec = EXCLUDED.audio_codec,
        audio_relative_path = EXCLUDED.audio_relative_path,
        audio_size_bytes = EXCLUDED.audio_size_bytes,
        audio_content_type = EXCLUDED.audio_content_type,
        created_at = now()
    `, [
      job.videoId, media.relativePath, media.sizeBytes, media.width, media.height,
      media.videoCodec, media.audioCodec, media.backgroundAudio?.relativePath ?? null,
      media.backgroundAudio?.sizeBytes ?? null, media.backgroundAudio?.contentType ?? null
    ]);
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

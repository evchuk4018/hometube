import { channelLabelFromUrl, normalizeYouTubeChannelUrl } from '@/domain/youtube-url';
import type { ChannelPagePayload } from '@/protocol/schemas';
import { NotFoundError } from '@/server/protocol/http';
import { getChannel, listChannelVideos, replaceSearchChannel } from './channel-repository';
import { enqueueChannelImport, getActiveChannelJob } from '@/server/jobs/job-repository';

export async function addChannel(input: string): Promise<{ channelId: string; jobId: string }> {
  const sourceUrl = normalizeYouTubeChannelUrl(input);
  const channel = await replaceSearchChannel(sourceUrl, channelLabelFromUrl(sourceUrl));
  const job = await enqueueChannelImport(channel.id);
  return { channelId: channel.id, jobId: job.id };
}

export async function refreshChannel(channelId: string): Promise<{ channelId: string; jobId: string }> {
  const channel = await getChannel(channelId);
  if (!channel) throw new NotFoundError('Channel not found.');
  const job = await enqueueChannelImport(channel.id);
  return { channelId: channel.id, jobId: job.id };
}

export async function getChannelPage(channelId: string, limit = 50, offset = 0): Promise<ChannelPagePayload> {
  const channel = await getChannel(channelId);
  if (!channel) throw new NotFoundError('Channel not found.');
  const [videos, activeJob] = await Promise.all([
    listChannelVideos(channelId, limit, offset),
    getActiveChannelJob(channelId)
  ]);
  return { channel, videos, total: channel.videoCount, activeJob };
}

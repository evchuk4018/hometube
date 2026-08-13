import type { FeedPayload } from '@/protocol/schemas';
import { NotFoundError } from '@/server/protocol/http';
import { listRankedFeed, recordFeedImpressions, recordVideoOpen, savePlaybackProgress } from './feed-repository';

export async function getHomeFeed(limit = 40): Promise<FeedPayload> {
  return { videos: await listRankedFeed(limit) };
}

export async function addFeedImpressions(videoIds: string[]) {
  await recordFeedImpressions([...new Set(videoIds)]);
  return { recorded: true };
}

export async function openVideo(videoId: string) {
  await recordVideoOpen(videoId);
}

export async function updatePlaybackProgress(videoId: string, positionSeconds: number, durationSeconds: number) {
  const watchState = await savePlaybackProgress(videoId, positionSeconds, durationSeconds);
  if (!watchState) throw new NotFoundError('Video not found.');
  return { watchState };
}

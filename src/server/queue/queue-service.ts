import {
  buildQueue,
  dismissQueuedVideo,
  QUEUE_SIZE,
  queueSessionExcludedChannels,
  type AutoplayCandidate,
  type AutoplayQueueItem
} from '@/domain/autoplay-queue';
import { selectRankedFeed } from '@/domain/feed-ranking';
import type { QueueEntry, VideoSummary } from '@/protocol/schemas';
import { getVideo } from '@/server/channels/channel-repository';
import { getActiveVideoDownloadJobs, enqueueVideoDownload } from '@/server/jobs/job-repository';
import { listRankedFeedRows, rankingCandidates, videoSummaries } from '@/server/feed/feed-repository';
import { ConflictError, NotFoundError } from '@/server/protocol/http';
import { getQueueState, replaceQueue } from './queue-repository';

export async function getQueue(): Promise<QueueEntry[]> {
  const state = await getQueueState();
  return loadEntries(state.videoIds);
}

export async function buildAndStoreQueue(currentVideoId: string): Promise<QueueEntry[]> {
  const current = await getVideo(currentVideoId);
  if (!current) throw new NotFoundError('Video not found.');
  const state = await getQueueState();
  const existing = await loadQueueItems(state.videoIds);
  const excluded = new Set(queueSessionExcludedChannels(current.id, existing, state.excludedChannelIds));
  const candidates = await loadRankedCandidates();
  const next = buildQueue(toItem(current), existing, candidates, excluded, QUEUE_SIZE);
  return storeQueue(next, excluded);
}

export async function dismissQueueEntry(currentVideoId: string, videoId: string): Promise<QueueEntry[]> {
  if (videoId === currentVideoId) throw new ConflictError('The current video cannot be dismissed.');
  const current = await getVideo(currentVideoId);
  if (!current) throw new NotFoundError('Video not found.');
  const active = await getQueueState();
  if (active.videoIds[0] !== currentVideoId) {
    if (!active.videoIds.includes(currentVideoId)) throw new ConflictError('The current video is not part of the active queue.');
    await buildAndStoreQueue(currentVideoId);
  }
  const synced = await getQueueState();
  const existing = await loadQueueItems(synced.videoIds);
  const candidates = await loadRankedCandidates();
  const dismissal = dismissQueuedVideo(
    toItem(current),
    existing,
    videoId,
    new Set(synced.excludedChannelIds),
    candidates,
    QUEUE_SIZE
  );
  if (!dismissal) return loadEntries(synced.videoIds);
  return storeQueue(dismissal.queue, new Set(dismissal.excludedChannelIds));
}

function toItem(video: VideoSummary): AutoplayQueueItem {
  return { videoId: video.id, channelId: video.channelId };
}

async function loadRankedCandidates(): Promise<AutoplayCandidate[]> {
  const rows = await listRankedFeedRows();
  const rankedIds = selectRankedFeed(rankingCandidates(rows), 100);
  const summaries = videoSummaries(rows);
  return rankedIds
    .flatMap((id) => summaries.get(id) ?? [])
    .map((video) => ({ videoId: video.id, channelId: video.channelId, watchState: video.watchState }));
}

async function storeQueue(queue: AutoplayQueueItem[], excludedChannelIds: ReadonlySet<string>): Promise<QueueEntry[]> {
  const videoIds = queue.map((item) => item.videoId);
  await replaceQueue(videoIds, [...excludedChannelIds]);
  const videos = await loadVideos(videoIds);
  await ensureDownloads(videos);
  return loadEntries(videoIds);
}

async function loadQueueItems(videoIds: string[]): Promise<AutoplayQueueItem[]> {
  return (await loadVideos(videoIds)).map(toItem);
}

async function loadVideos(videoIds: string[]): Promise<VideoSummary[]> {
  return (await Promise.all(videoIds.map((id) => getVideo(id))))
    .filter((video): video is VideoSummary => video !== null);
}

async function loadEntries(videoIds: string[]): Promise<QueueEntry[]> {
  const videos = await loadVideos(videoIds);
  const jobs = await getActiveVideoDownloadJobs(videos.map((video) => video.id));
  const jobsByVideo = new Map(jobs.map(({ job, videoId }) => [videoId, job]));
  return videos.map((video) => ({ video, job: jobsByVideo.get(video.id) ?? null }));
}

async function ensureDownloads(videos: VideoSummary[]): Promise<void> {
  for (const video of videos) {
    if (!video.downloadable || video.mediaStatus === 'ready') continue;
    await enqueueVideoDownload(video.id, video.channelId);
  }
}

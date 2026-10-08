import {
  buildQueue,
  dismissQueuedVideo,
  filterSubscribedQueue,
  QUEUE_SIZE,
  queueSessionExcludedChannels,
  type AutoplayCandidate,
  type AutoplayQueueItem
} from '@/domain/autoplay-queue';
import type { JobSummary, QueueEntry, VideoSummary } from '@/protocol/schemas';
import { ConflictError, NotFoundError } from '@/server/protocol/http';
import type { PersistedQueue } from './queue-repository';

export type QueueServiceDependencies = {
  getQueueState(): Promise<PersistedQueue>;
  getSubscribedChannelIds(channelIds: string[]): Promise<ReadonlySet<string>>;
  replaceQueue(videoIds: string[], excludedChannelIds: string[]): Promise<void>;
  getVideo(videoId: string): Promise<VideoSummary | null>;
  getActiveVideoDownloadJobs(videoIds: string[]): Promise<Array<{ job: JobSummary; videoId: string }>>;
  enqueueVideoDownload(videoId: string, channelId: string): Promise<unknown>;
  loadRankedCandidates(): Promise<AutoplayCandidate[]>;
};

export function createQueueService(dependencies: QueueServiceDependencies) {
  async function getQueue(): Promise<QueueEntry[]> {
    const state = await dependencies.getQueueState();
    const existing = await loadQueueItems(state.videoIds);
    const eligible = await subscribedQueue(existing, state.currentVideoId);
    return loadEntries(eligible.map((item) => item.videoId));
  }

  async function buildAndStoreQueue(currentVideoId: string): Promise<QueueEntry[]> {
    const current = await dependencies.getVideo(currentVideoId);
    if (!current) throw new NotFoundError('Video not found.');
    const state = await dependencies.getQueueState();
    const existing = await loadQueueItems(state.videoIds);
    // Session continuity depends on the original queue, before subscription filtering.
    const excluded = new Set(queueSessionExcludedChannels(current.id, existing, state.excludedChannelIds));
    const eligible = await subscribedQueue(existing, current.id);
    const candidates = await dependencies.loadRankedCandidates();
    const next = buildQueue(toItem(current), eligible, candidates, excluded, QUEUE_SIZE);
    return storeQueue(next, excluded);
  }

  async function dismissQueueEntry(currentVideoId: string, videoId: string): Promise<QueueEntry[]> {
    if (videoId === currentVideoId) throw new ConflictError('The current video cannot be dismissed.');
    const current = await dependencies.getVideo(currentVideoId);
    if (!current) throw new NotFoundError('Video not found.');
    const active = await dependencies.getQueueState();
    if (active.videoIds[0] !== currentVideoId) {
      if (!active.videoIds.includes(currentVideoId)) throw new ConflictError('The current video is not part of the active queue.');
      await buildAndStoreQueue(currentVideoId);
    }
    const synced = await dependencies.getQueueState();
    const existing = await loadQueueItems(synced.videoIds);
    const excluded = new Set(queueSessionExcludedChannels(current.id, existing, synced.excludedChannelIds));
    const eligible = await subscribedQueue(existing, current.id);
    const candidates = await dependencies.loadRankedCandidates();
    const dismissal = dismissQueuedVideo(toItem(current), eligible, videoId, excluded, candidates, QUEUE_SIZE);
    if (dismissal) return storeQueue(dismissal.queue, new Set(dismissal.excludedChannelIds));
    // A stale dismissal still removes entries whose channels were unsubscribed.
    if (eligible.length !== synced.videoIds.length) return storeQueue(eligible, excluded);
    return loadEntries(synced.videoIds);
  }

  async function subscribedQueue(queue: AutoplayQueueItem[], currentVideoId: string | null): Promise<AutoplayQueueItem[]> {
    const subscribed = await dependencies.getSubscribedChannelIds(queue.map((item) => item.channelId));
    return filterSubscribedQueue(queue, subscribed, currentVideoId);
  }

  async function storeQueue(queue: AutoplayQueueItem[], excludedChannelIds: ReadonlySet<string>): Promise<QueueEntry[]> {
    const videoIds = queue.map((item) => item.videoId);
    await dependencies.replaceQueue(videoIds, [...excludedChannelIds]);
    const videos = await loadVideos(videoIds);
    for (const video of videos) {
      if (!video.downloadable || video.mediaStatus === 'ready') continue;
      await dependencies.enqueueVideoDownload(video.id, video.channelId);
    }
    return loadEntries(videoIds);
  }

  async function loadQueueItems(videoIds: string[]): Promise<AutoplayQueueItem[]> {
    return (await loadVideos(videoIds)).map(toItem);
  }

  async function loadVideos(videoIds: string[]): Promise<VideoSummary[]> {
    return (await Promise.all(videoIds.map((id) => dependencies.getVideo(id))))
      .filter((video): video is VideoSummary => video !== null);
  }

  async function loadEntries(videoIds: string[]): Promise<QueueEntry[]> {
    const videos = await loadVideos(videoIds);
    const jobs = await dependencies.getActiveVideoDownloadJobs(videos.map((video) => video.id));
    const jobsByVideo = new Map(jobs.map(({ job, videoId }) => [videoId, job]));
    return videos.map((video) => ({ video, job: jobsByVideo.get(video.id) ?? null }));
  }

  return { getQueue, buildAndStoreQueue, dismissQueueEntry };
}

function toItem(video: VideoSummary): AutoplayQueueItem {
  return { videoId: video.id, channelId: video.channelId };
}

import { buildQueue, QUEUE_SIZE, type AutoplayCandidate } from '@/domain/autoplay-queue';
import { selectRankedFeed } from '@/domain/feed-ranking';
import type { QueueEntry, VideoSummary } from '@/protocol/schemas';
import { getVideo } from '@/server/channels/channel-repository';
import { getActiveVideoDownloadJobs, enqueueVideoDownload } from '@/server/jobs/job-repository';
import { listRankedFeedRows, rankingCandidates, videoSummaries } from '@/server/feed/feed-repository';
import { NotFoundError } from '@/server/protocol/http';
import { getQueueVideoIds, replaceQueue } from './queue-repository';

export async function getQueue(): Promise<QueueEntry[]> {
  return loadEntries(await getQueueVideoIds());
}

export async function buildAndStoreQueue(currentVideoId: string): Promise<QueueEntry[]> {
  const current = await getVideo(currentVideoId);
  if (!current) throw new NotFoundError('Video not found.');
  const existing = await getQueueVideoIds();
  const rows = await listRankedFeedRows();
  const rankedIds = selectRankedFeed(rankingCandidates(rows), 100);
  const summaries = videoSummaries(rows);
  const candidates: AutoplayCandidate[] = rankedIds
    .flatMap((id) => summaries.get(id) ?? [])
    .map((video) => ({ videoId: video.id, watchState: video.watchState }));
  const nextIds = buildQueue(currentVideoId, existing, candidates, QUEUE_SIZE);
  await replaceQueue(nextIds);
  const entries = await loadEntries(nextIds);
  await ensureDownloads(entries);
  return entries;
}

async function loadEntries(videoIds: string[]): Promise<QueueEntry[]> {
  const videos = (await Promise.all(videoIds.map((id) => getVideo(id))))
    .filter((video): video is VideoSummary => video !== null);
  const jobs = await getActiveVideoDownloadJobs(videos.map((video) => video.id));
  const jobsByVideo = new Map(jobs.map(({ job, videoId }) => [videoId, job]));
  return videos.map((video) => ({ video, job: jobsByVideo.get(video.id) ?? null }));
}

async function ensureDownloads(entries: QueueEntry[]): Promise<void> {
  for (const entry of entries) {
    const video = entry.video;
    if (!video.downloadable || video.mediaStatus === 'ready') continue;
    await enqueueVideoDownload(video.id, video.channelId);
  }
}

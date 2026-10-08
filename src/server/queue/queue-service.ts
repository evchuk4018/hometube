import { selectRankedFeed } from '@/domain/feed-ranking';
import type { AutoplayCandidate } from '@/domain/autoplay-queue';
import { getVideo } from '@/server/channels/channel-repository';
import { getActiveVideoDownloadJobs, enqueueVideoDownload } from '@/server/jobs/job-repository';
import { listRankedFeedRows, rankingCandidates, videoSummaries } from '@/server/feed/feed-repository';
import { createQueueService } from './queue-service-core';
import { getQueueState, getSubscribedQueueChannelIds, replaceQueue } from './queue-repository';

async function loadRankedCandidates(): Promise<AutoplayCandidate[]> {
  const rows = await listRankedFeedRows();
  const rankedIds = selectRankedFeed(rankingCandidates(rows), 100);
  const summaries = videoSummaries(rows);
  return rankedIds
    .flatMap((id) => summaries.get(id) ?? [])
    .map((video) => ({ videoId: video.id, channelId: video.channelId, watchState: video.watchState }));
}

export const { getQueue, buildAndStoreQueue, dismissQueueEntry } = createQueueService({
  getQueueState,
  getSubscribedChannelIds: getSubscribedQueueChannelIds,
  replaceQueue,
  getVideo,
  getActiveVideoDownloadJobs,
  enqueueVideoDownload,
  loadRankedCandidates
});

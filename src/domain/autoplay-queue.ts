export const QUEUE_SIZE = 3;

export type AutoplayQueueItem = {
  videoId: string;
  channelId: string;
};

export type AutoplayCandidate = AutoplayQueueItem & {
  watchState: 'unwatched' | 'in_progress' | 'watched';
};

export type QueueDismissal = {
  queue: AutoplayQueueItem[];
  excludedChannelIds: string[];
};

export function buildQueue(
  current: AutoplayQueueItem,
  existingQueue: AutoplayQueueItem[],
  rankedCandidates: AutoplayCandidate[],
  excludedChannelIds: ReadonlySet<string> = new Set(),
  queueSize = QUEUE_SIZE
): AutoplayQueueItem[] {
  const currentIndex = existingQueue.findIndex((item) => item.videoId === current.videoId);
  const base = currentIndex >= 0
    ? [
        existingQueue[currentIndex],
        ...existingQueue.slice(currentIndex + 1).filter((item) => !excludedChannelIds.has(item.channelId))
      ].slice(0, queueSize)
    : [current];
  const used = new Set(base.map((item) => item.videoId));
  const tail: AutoplayQueueItem[] = [];
  for (const candidate of rankedCandidates) {
    if (base.length + tail.length >= queueSize) break;
    if (candidate.watchState === 'watched') continue;
    if (excludedChannelIds.has(candidate.channelId)) continue;
    if (used.has(candidate.videoId)) continue;
    tail.push({ videoId: candidate.videoId, channelId: candidate.channelId });
    used.add(candidate.videoId);
  }
  return [...base, ...tail];
}

export function dismissQueuedVideo(
  current: AutoplayQueueItem,
  existingQueue: AutoplayQueueItem[],
  dismissedVideoId: string,
  excludedChannelIds: ReadonlySet<string>,
  rankedCandidates: AutoplayCandidate[],
  queueSize = QUEUE_SIZE
): QueueDismissal | null {
  if (dismissedVideoId === current.videoId) return null;
  const dismissed = existingQueue.find((item) => item.videoId === dismissedVideoId);
  if (!dismissed) return null;
  const excluded = new Set(excludedChannelIds);
  excluded.add(dismissed.channelId);
  return {
    queue: buildQueue(current, existingQueue, rankedCandidates, excluded, queueSize),
    excludedChannelIds: [...excluded]
  };
}

export function queueSessionExcludedChannels(
  currentVideoId: string,
  existingQueue: AutoplayQueueItem[],
  excludedChannelIds: string[]
): string[] {
  return existingQueue.some((item) => item.videoId === currentVideoId) ? excludedChannelIds : [];
}

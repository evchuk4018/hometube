export const QUEUE_SIZE = 3;

export type AutoplayCandidate = {
  videoId: string;
  watchState: 'unwatched' | 'in_progress' | 'watched';
};

export function buildQueue(
  currentVideoId: string,
  existingQueue: string[],
  rankedCandidates: AutoplayCandidate[],
  queueSize = QUEUE_SIZE
): string[] {
  const currentIndex = existingQueue.indexOf(currentVideoId);
  const base = currentIndex >= 0
    ? existingQueue.slice(currentIndex).slice(0, queueSize)
    : [currentVideoId];
  const used = new Set(base);
  const tail: string[] = [];
  for (const candidate of rankedCandidates) {
    if (base.length + tail.length >= queueSize) break;
    if (candidate.watchState === 'watched') continue;
    if (used.has(candidate.videoId)) continue;
    tail.push(candidate.videoId);
    used.add(candidate.videoId);
  }
  return [...base, ...tail];
}

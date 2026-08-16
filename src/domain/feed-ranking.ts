export const REFRESH_PENALTY = 0.07;

export type RankingCandidate = {
  videoId: string;
  channelId: string;
  trial: boolean;
  subscribed: boolean;
  watchState: 'unwatched' | 'in_progress' | 'watched';
  watchPercentage: number | null;
  uploadDate: string | null;
  viewCount: number | null;
  channelViewMax: number;
  channelWeightedWatch: number;
  channelEvidence: number;
  refreshPenalty: number;
};

const CHANNEL_PRIOR = 0.35;
const CHANNEL_PRIOR_WEIGHT = 3;
const MOSTLY_WATCHED_PENALTY = 0.5;
const MOSTLY_WATCHED_THRESHOLD = 0.5;
const MOSTLY_WATCHED_SPAN = 0.3;
const DAY_MS = 86_400_000;

export function rankScore(candidate: RankingCandidate, now = new Date()): number {
  const engagement = (
    candidate.channelWeightedWatch + CHANNEL_PRIOR * CHANNEL_PRIOR_WEIGHT
  ) / (candidate.channelEvidence + CHANNEL_PRIOR_WEIGHT);
  const ageDays = candidate.uploadDate
    ? Math.max(0, (now.getTime() - new Date(`${candidate.uploadDate}T00:00:00Z`).getTime()) / DAY_MS)
    : 365;
  const recency = 2 ** (-ageDays / 7);
  const view = candidate.viewCount === null || candidate.channelViewMax <= 0
    ? 0
    : Math.log1p(candidate.viewCount) / Math.log1p(candidate.channelViewMax);
  const mostlyWatched = candidate.watchPercentage === null
    ? 0
    : Math.min(1, Math.max(0, (candidate.watchPercentage - MOSTLY_WATCHED_THRESHOLD) / MOSTLY_WATCHED_SPAN));
  return 0.5 * engagement + 0.25 * recency + 0.2 * view + (candidate.subscribed ? 0.05 : 0)
    - MOSTLY_WATCHED_PENALTY * mostlyWatched
    - candidate.refreshPenalty;
}

export function selectRankedFeed(
  candidates: RankingCandidate[],
  limit = 40,
  trialShare = 0.2,
  perChannelLimit = 4,
  now = new Date()
): string[] {
  const scored = candidates
    .filter((candidate) => candidate.watchState !== 'watched')
    .map((candidate) => ({ ...candidate, score: rankScore(candidate, now) }));
  const trialTarget = Math.min(Math.round(limit * trialShare), scored.filter((item) => item.trial).length);
  const establishedTarget = Math.max(0, limit - trialTarget);
  const counts = new Map<string, number>();

  function take(pool: typeof scored, target: number): typeof scored {
    const picked: typeof scored = [];
    for (const item of pool.sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId))) {
      if (picked.length >= target) break;
      const count = counts.get(item.channelId) ?? 0;
      if (count >= perChannelLimit) continue;
      counts.set(item.channelId, count + 1);
      picked.push(item);
    }
    return picked;
  }

  const established = take(scored.filter((item) => !item.trial), establishedTarget);
  const trials = take(scored.filter((item) => item.trial), trialTarget);
  const pickedIds = new Set([...established, ...trials].map((item) => item.videoId));
  const remaining = take(scored.filter((item) => !pickedIds.has(item.videoId)), limit - established.length - trials.length);
  const combined = [...established, ...trials, ...remaining].sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId));
  return combined.map((item) => item.videoId);
}

export function playbackState(positionSeconds: number, durationSeconds: number, threshold = 0.8) {
  const percentage = durationSeconds > 0 ? Math.min(1, Math.max(0, positionSeconds / durationSeconds)) : 0;
  return {
    percentage,
    state: percentage >= threshold ? 'watched' as const : percentage > 0 ? 'in_progress' as const : 'unwatched' as const
  };
}

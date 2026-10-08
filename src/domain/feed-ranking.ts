export const REFRESH_PENALTY = 0.07;

export type RankingCandidate = {
  videoId: string;
  channelId: string;
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

export type RankingPolicy = {
  channelGroupSize: number;
  subscribedBonus: number;
  perChannelLimit: number;
};

export const DEFAULT_RANKING_POLICY: RankingPolicy = {
  channelGroupSize: 5,
  subscribedBonus: 0.05,
  perChannelLimit: 4
};

export const HOME_RANKING_POLICY: RankingPolicy = {
  channelGroupSize: 5,
  subscribedBonus: 0.2,
  perChannelLimit: 4
};

const CHANNEL_PRIOR = 0.35;
const CHANNEL_PRIOR_WEIGHT = 3;
const MOSTLY_WATCHED_PENALTY = 0.5;
const MOSTLY_WATCHED_THRESHOLD = 0.5;
const MOSTLY_WATCHED_SPAN = 0.3;
const DAY_MS = 86_400_000;

export function rankScore(
  candidate: RankingCandidate,
  now = new Date(),
  policy: RankingPolicy = DEFAULT_RANKING_POLICY
): number {
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
  return 0.5 * engagement + 0.25 * recency + 0.2 * view + (candidate.subscribed ? policy.subscribedBonus : 0)
    - MOSTLY_WATCHED_PENALTY * mostlyWatched
    - candidate.refreshPenalty;
}

export function selectRankedFeed(
  candidates: RankingCandidate[],
  limit = 40,
  policy: RankingPolicy = DEFAULT_RANKING_POLICY,
  now = new Date()
): string[] {
  const scored = candidates
    .filter((candidate) => candidate.subscribed && candidate.watchState !== 'watched')
    .map((candidate) => ({ ...candidate, score: rankScore(candidate, now, policy) }))
    .sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId));
  const counts = new Map<string, number>();
  const pickedIds = new Set<string>();
  const groupChannels = new Set<string>();
  const picked: string[] = [];

  const eligible = (item: typeof scored[number]) =>
    !pickedIds.has(item.videoId) && (counts.get(item.channelId) ?? 0) < policy.perChannelLimit;

  while (picked.length < limit) {
    if (picked.length % policy.channelGroupSize === 0) groupChannels.clear();
    let next = scored.find((item) => eligible(item) && !groupChannels.has(item.channelId));
    if (!next) {
      // With fewer channels available, use each before starting another pass.
      next = scored.find(eligible);
      if (!next) break;
      groupChannels.clear();
    }
    picked.push(next.videoId);
    pickedIds.add(next.videoId);
    groupChannels.add(next.channelId);
    counts.set(next.channelId, (counts.get(next.channelId) ?? 0) + 1);
  }

  return picked;
}

export function playbackState(positionSeconds: number, durationSeconds: number, threshold = 0.8) {
  const percentage = durationSeconds > 0 ? Math.min(1, Math.max(0, positionSeconds / durationSeconds)) : 0;
  return {
    percentage,
    state: percentage >= threshold ? 'watched' as const : percentage > 0 ? 'in_progress' as const : 'unwatched' as const
  };
}

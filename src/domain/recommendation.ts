import type { Channel, FeedVideo, Video } from "./types";

export type ChannelScoreInput = Pick<
  Channel,
  | "videosPresented"
  | "videosOpened"
  | "videosWatched"
  | "averagePercentageWatched"
  | "recentEngagement"
  | "lastInteractionAt"
  | "isRetained"
  | "isPinned"
  | "isPruned"
  | "isPodcast"
  | "source"
>;

function recencyBoost(lastInteractionAt?: string | null, now = Date.now()): number {
  if (!lastInteractionAt) return 0;
  const ageDays = Math.max(0, (now - Date.parse(lastInteractionAt)) / 86_400_000);
  return Math.exp(-ageDays / 30);
}

export function scoreChannel(channel: ChannelScoreInput, now = Date.now()): number {
  const openedRate = channel.videosPresented > 0 ? channel.videosOpened / channel.videosPresented : 0;
  const watchedRate = channel.videosOpened > 0 ? channel.videosWatched / channel.videosOpened : 0;
  const meaningfulWatch = channel.averagePercentageWatched * 0.55 + watchedRate * 0.3 + openedRate * 0.15;
  const evidence = Math.log1p(channel.videosWatched) * 1.5 + Math.log1p(channel.videosOpened) * 0.35;
  const boundedRecent = Math.max(0, Math.min(1, channel.recentEngagement));
  const sourceBoost = channel.source === "user_added" ? 0.35 : channel.source === "initial_seed" ? 0.1 : 0;
  const protectionBoost = channel.isPinned || channel.isRetained ? 0.6 : 0;
  const podcastBoost = channel.isPodcast ? 0.25 : 0;
  const prunePenalty = channel.isPruned ? 100 : 0;
  // Evidence grows logarithmically, so a single successful video cannot erase
  // substantial history from other channels.
  return evidence * (0.4 + meaningfulWatch) + boundedRecent * 1.25 + recencyBoost(channel.lastInteractionAt, now) + sourceBoost + protectionBoost + podcastBoost - prunePenalty;
}

export type RankableVideo = Video & {
  channelPreference: number;
  channelVideosPresented?: number;
  channelVideosWatched?: number;
};

function videoScore(video: RankableVideo, now: number): number {
  const ageDays = video.publishedAt ? Math.max(0, (now - Date.parse(video.publishedAt)) / 86_400_000) : 365;
  const recency = Math.exp(-ageDays / 45);
  const completionSignal = video.watchPercentage * 0.75;
  const diversity = video.isTrial ? 0.25 : 0;
  const viewSignal = Math.log1p(video.viewCount ?? 0) / 25;
  const watchedPenalty = video.watchState === "watched" ? 100 : video.watchState === "in_progress" ? 0.2 : 0;
  return video.channelPreference * 2.8 + recency * 0.8 + completionSignal + diversity + viewSignal - watchedPenalty;
}

function coldStartVideoScore(video: RankableVideo, now: number, shuffle: number): number {
  const ageDays = video.publishedAt ? Math.max(0, (now - Date.parse(video.publishedAt)) / 86_400_000) : 365;
  const recency = Math.exp(-ageDays / 45);
  const viewSignal = Math.log1p(video.viewCount ?? 0) / 25;
  // Metadata is only a small tie-breaker while the channel has no completed watches.
  return shuffle + recency * 0.03 + viewSignal * 0.02 + (video.isTrial ? 0.02 : 0);
}

function isColdStart(video: RankableVideo): boolean {
  return (video.channelVideosWatched ?? 0) === 0;
}

function presentationPenalty(video: RankableVideo): number {
  return Math.log1p(Math.max(0, video.channelVideosPresented ?? 0));
}

export function rankHomeVideos(videos: RankableVideo[], target = 40, now = Date.now(), random = Math.random): FeedVideo[] {
  const eligible = videos.filter((video) => video.watchState !== "watched" && !video.isIgnored);
  const groups = new Map<string, RankableVideo[]>();
  for (const video of eligible) {
    const group = groups.get(video.channelId) ?? [];
    group.push(video);
    groups.set(video.channelId, group);
  }

  const shuffleKeys = new Map<string, number>();
  const coldVideoShuffleKeys = new Map<string, number>();
  for (const [channelId, group] of groups) {
    if (isColdStart(group[0])) {
      shuffleKeys.set(channelId, random());
      for (const video of group) coldVideoShuffleKeys.set(video.id, random());
      group.sort((a, b) => coldStartVideoScore(b, now, coldVideoShuffleKeys.get(b.id) ?? 0) - coldStartVideoScore(a, now, coldVideoShuffleKeys.get(a.id) ?? 0));
    } else {
      group.sort((a, b) => videoScore(b, now) - videoScore(a, now));
    }
  }

  const ranked: FeedVideo[] = [];
  const channelOrder = [...groups.entries()].sort(([, left], [, right]) => {
    const leftScore = isColdStart(left[0])
      ? (shuffleKeys.get(left[0].channelId) ?? 0) - presentationPenalty(left[0])
      : videoScore(left[0], now);
    const rightScore = isColdStart(right[0])
      ? (shuffleKeys.get(right[0].channelId) ?? 0) - presentationPenalty(right[0])
      : videoScore(right[0], now);
    return rightScore - leftScore;
  });
  let round = 0;
  while (ranked.length < target && channelOrder.some(([, group]) => group.length > 0)) {
    for (const [, group] of channelOrder) {
      const video = group.shift();
      if (!video) continue;
      ranked.push({
        ...video,
        recommendationReason: video.isTrial ? "Trial pick from this channel's most-viewed unwatched videos" : round === 0 ? "Matched to your channel preferences" : "A diverse follow-up from a channel you may enjoy",
        recommendationPosition: ranked.length + 1
      });
      if (ranked.length >= target) break;
    }
    round += 1;
  }
  return ranked;
}

export function topChannelsForDiscovery(channels: Channel[], count = 10): Channel[] {
  return channels
    .filter((channel) => !channel.isPruned)
    .sort((left, right) => scoreChannel(right) - scoreChannel(left))
    .slice(0, count);
}

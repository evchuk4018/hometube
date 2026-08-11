export const WATCH_STATES = ["unwatched", "in_progress", "watched"] as const;
export type WatchState = (typeof WATCH_STATES)[number];

export const CHANNEL_SOURCES = ["user_added", "initial_seed", "ai_recommendation", "podcast"] as const;
export type ChannelSource = (typeof CHANNEL_SOURCES)[number];

export const MEDIA_STATES = ["queued", "downloading", "ready", "failed", "unavailable", "deleted"] as const;
export type MediaState = (typeof MEDIA_STATES)[number];

export type Channel = {
  id: string;
  providerId: string;
  name: string;
  handle?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  source: ChannelSource;
  isSubscribed: boolean;
  isRetained: boolean;
  isPruned: boolean;
  isPodcast: boolean;
  isPinned: boolean;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  videosPresented: number;
  videosOpened: number;
  videosWatched: number;
  averagePercentageWatched: number;
  recentEngagement: number;
  lastInteractionAt?: string | null;
  rejectionCount: number;
  lastRejectionReason?: string | null;
  lastAiJustification?: string | null;
};

export type MediaFile = {
  id: string;
  videoId: string;
  path: string;
  bytes: number;
  height: number;
  mimeType: string;
  state: MediaState;
  downloadedAt?: string | null;
  lastAccessedAt?: string | null;
};

export type Video = {
  id: string;
  providerId: string;
  channelId: string;
  channelName: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  durationSeconds: number;
  viewCount?: number | null;
  watchState: WatchState;
  progressSeconds: number;
  watchPercentage: number;
  isTrial: boolean;
  isIgnored: boolean;
  isPinned: boolean;
  recommendationScore: number;
  isPodcast: boolean;
  media?: MediaFile | null;
};

export type FeedVideo = Video & {
  recommendationReason: string;
  recommendationPosition: number;
};

export type ProviderVideo = {
  providerId: string;
  channelProviderId: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  durationSeconds: number;
  viewCount?: number | null;
};

export type FormatCandidate = {
  formatId?: string;
  height?: number | null;
  width?: number | null;
  ext?: string | null;
  filesize?: number | null;
  filesizeApprox?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
};

export type EvictionCandidate = {
  mediaId: string;
  videoId: string;
  bytes: number;
  watchState: WatchState;
  isPodcast: boolean;
  isPodcastProtected: boolean;
  isPinned: boolean;
  channelPruned: boolean;
  isTrial: boolean;
  isIgnored: boolean;
  recommendationScore: number;
  lastAccessedAt?: string | null;
};

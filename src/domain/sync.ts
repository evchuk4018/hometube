import type { ProviderVideo, Video } from "./types";

export function stableVideoIdentity(providerId: string): string {
  const normalized = providerId.trim();
  if (!normalized) throw new Error("A provider video ID is required.");
  return `youtube:${normalized}`;
}

export function mergeVideoMetadata(existing: Video | null, incoming: ProviderVideo, channelName: string, channelId: string): Video {
  if (!existing) {
    return {
      id: stableVideoIdentity(incoming.providerId),
      providerId: incoming.providerId,
      channelId,
      channelName,
      title: incoming.title,
      description: incoming.description ?? null,
      thumbnailUrl: incoming.thumbnailUrl ?? null,
      publishedAt: incoming.publishedAt ?? null,
      durationSeconds: incoming.durationSeconds,
      viewCount: incoming.viewCount ?? null,
      watchState: "unwatched",
      progressSeconds: 0,
      watchPercentage: 0,
      isTrial: false,
      isIgnored: false,
      isPinned: false,
      recommendationScore: 0,
      isPodcast: false,
      media: null
    };
  }
  return {
    ...existing,
    channelId,
    channelName,
    title: incoming.title,
    description: incoming.description ?? existing.description ?? null,
    thumbnailUrl: incoming.thumbnailUrl ?? existing.thumbnailUrl ?? null,
    publishedAt: incoming.publishedAt ?? existing.publishedAt ?? null,
    durationSeconds: incoming.durationSeconds || existing.durationSeconds,
    viewCount: incoming.viewCount ?? existing.viewCount ?? null
  };
}

export function deduplicateProviderVideos(videos: ProviderVideo[]): ProviderVideo[] {
  const unique = new Map<string, ProviderVideo>();
  for (const video of videos) unique.set(video.providerId, video);
  return [...unique.values()];
}

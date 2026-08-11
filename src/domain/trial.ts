import type { ProviderVideo, Video } from "./types";

export function buildTrialPool(videos: Array<Pick<Video, "providerId" | "viewCount" | "watchState"> | ProviderVideo>, watchedProviderIds: Set<string>, size = 10): string[] {
  return [...videos]
    .filter((video) => !("watchState" in video) || video.watchState !== "watched")
    .filter((video) => !watchedProviderIds.has(video.providerId))
    .sort((left, right) => (right.viewCount ?? 0) - (left.viewCount ?? 0))
    .slice(0, size)
    .map((video) => video.providerId);
}

export function shouldPromoteTrial(input: { videosPresented: number; videosOpened: number; videosWatched: number; averagePercentageWatched: number }): boolean {
  if (input.videosPresented < 3) return false;
  const openRate = input.videosOpened / input.videosPresented;
  const watchedRate = input.videosOpened > 0 ? input.videosWatched / input.videosOpened : 0;
  return openRate >= 0.3 && (watchedRate >= 0.25 || input.averagePercentageWatched >= 0.45);
}

export function shouldPruneTrial(input: { trialEndsAt?: string | null; now?: number; isPinned: boolean; videosOpened: number; videosWatched: number; averagePercentageWatched: number }): boolean {
  if (input.isPinned || !input.trialEndsAt) return false;
  if ((input.now ?? Date.now()) < Date.parse(input.trialEndsAt)) return false;
  return input.videosOpened === 0 || (input.videosWatched === 0 && input.averagePercentageWatched < 0.15);
}

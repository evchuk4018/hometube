import type { WatchState } from "./types";

export function shouldAutomaticallyDownloadPodcastEpisode(publishedAt?: string | null, podcastStartedAt?: string | null): boolean {
  if (!publishedAt || !podcastStartedAt) return false;
  const publishedTime = Date.parse(publishedAt);
  const startedTime = Date.parse(podcastStartedAt);
  if (!Number.isFinite(publishedTime) || !Number.isFinite(startedTime)) return false;
  return publishedTime > startedTime;
}

export function isPodcastMediaProtected(watchState: WatchState): boolean {
  return watchState === "unwatched" || watchState === "in_progress";
}

export function shouldDeleteCompletedPodcastMedia(watchState: WatchState): boolean {
  return watchState === "watched";
}

export function podcastSections<T extends { watchState: WatchState }>(episodes: T[]): { unwatched: T[]; inProgress: T[]; completed: T[] } {
  return {
    unwatched: episodes.filter((episode) => episode.watchState === "unwatched"),
    inProgress: episodes.filter((episode) => episode.watchState === "in_progress"),
    completed: episodes.filter((episode) => episode.watchState === "watched")
  };
}

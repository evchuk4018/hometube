import type { WatchState } from "./types";

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

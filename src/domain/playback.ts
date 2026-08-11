import type { Video } from "./types";

export function selectNextPlaybackVideo(videos: readonly Video[], currentVideoId?: string | null): Video | null {
  return videos.find((video) =>
    video.id !== currentVideoId &&
    video.watchState === "unwatched" &&
    !video.isIgnored &&
    video.media?.state === "ready"
  ) ?? null;
}

import type { MediaState, Video } from "./types";

export const DOWNLOAD_LIST_STATES = ["queued", "downloading", "ready", "failed", "unavailable"] as const satisfies readonly MediaState[];

export function isDownloadListed(video: Pick<Video, "media">): boolean {
  switch (video.media?.state) {
    case "queued":
    case "downloading":
    case "ready":
    case "failed":
    case "unavailable":
      return true;
    default:
      return false;
  }
}

export function isDownloadInProgress(video: Pick<Video, "media">): boolean {
  return video.media?.state === "queued" || video.media?.state === "downloading";
}

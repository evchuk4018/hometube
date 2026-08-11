import type { EvictionCandidate, FormatCandidate } from "./types";

export const MAX_MEDIA_HEIGHT = 720;
export const MAX_MEDIA_BYTES = 128 * 1024 ** 3;
export const DEFAULT_MEDIA_TARGET_BYTES = 120 * 1024 ** 3;

// All automatic and manual downloads must use this selector. The first choices
// favor a directly playable MP4, while every fallback remains <= 720p.
export const YTDLP_FORMAT_SELECTOR =
  "best[height<=720][ext=mp4]/best[height<=720]/bestvideo[height<=720]+bestaudio/best[height<=720]";

export class MediaPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaPolicyError";
  }
}

export function configuredMediaTarget(rawValue = process.env.MEDIA_TARGET_BYTES): number {
  if (!rawValue) return DEFAULT_MEDIA_TARGET_BYTES;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MEDIA_TARGET_BYTES;
  return Math.min(Math.floor(parsed), MAX_MEDIA_BYTES);
}

export function validateFormatCandidate(candidate: FormatCandidate): void {
  if (candidate.height != null && candidate.height > MAX_MEDIA_HEIGHT) {
    throw new MediaPolicyError(`Video format is ${candidate.height}p; maximum allowed is ${MAX_MEDIA_HEIGHT}p.`);
  }
  const bytes = candidate.filesize ?? candidate.filesizeApprox;
  if (bytes != null && bytes > MAX_MEDIA_BYTES) {
    throw new MediaPolicyError("The selected media file exceeds the 128 GiB cache ceiling.");
  }
}

export function assertDownloadedMediaPolicy(bytes: number, height: number): void {
  if (!Number.isInteger(height) || height < 1 || height > MAX_MEDIA_HEIGHT) {
    throw new MediaPolicyError(`Downloaded media height must be between 1p and ${MAX_MEDIA_HEIGHT}p.`);
  }
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_MEDIA_BYTES) {
    throw new MediaPolicyError("Downloaded media size is outside the 128 GiB cache ceiling.");
  }
}

export function getEvictionPriority(candidate: EvictionCandidate): number {
  if (candidate.isPinned || candidate.isPodcastProtected) return Number.POSITIVE_INFINITY;
  if (candidate.isPodcast && candidate.watchState === "watched") return 0;
  if (candidate.watchState === "watched" && !candidate.isPodcast) return 1;
  if (candidate.channelPruned) return 2;
  if (candidate.isTrial || candidate.isIgnored) return 3;
  return 4;
}

export function orderEvictionCandidates(candidates: EvictionCandidate[]): EvictionCandidate[] {
  return [...candidates]
    .filter((candidate) => Number.isFinite(getEvictionPriority(candidate)))
    .sort((left, right) => {
      const priorityDelta = getEvictionPriority(left) - getEvictionPriority(right);
      if (priorityDelta !== 0) return priorityDelta;
      const scoreDelta = left.recommendationScore - right.recommendationScore;
      if (scoreDelta !== 0) return scoreDelta;
      const leftAccess = left.lastAccessedAt ? Date.parse(left.lastAccessedAt) : 0;
      const rightAccess = right.lastAccessedAt ? Date.parse(right.lastAccessedAt) : 0;
      return leftAccess - rightAccess;
    });
}

export function planEvictions(
  currentBytes: number,
  incomingBytes: number,
  candidates: EvictionCandidate[],
  targetBytes = configuredMediaTarget()
): EvictionCandidate[] {
  if (!Number.isFinite(currentBytes) || currentBytes < 0) {
    throw new MediaPolicyError("Current cache size must be a non-negative number.");
  }
  assertDownloadedMediaPolicy(incomingBytes, 1);
  const ceiling = Math.min(Math.max(1, Math.floor(targetBytes)), MAX_MEDIA_BYTES);
  const required = Math.max(0, currentBytes + incomingBytes - ceiling);
  if (required === 0) return [];

  const selected: EvictionCandidate[] = [];
  let reclaimed = 0;
  for (const candidate of orderEvictionCandidates(candidates)) {
    selected.push(candidate);
    reclaimed += candidate.bytes;
    if (reclaimed >= required) return selected;
  }
  throw new MediaPolicyError("There is not enough unprotected media to make room in the cache.");
}

export function mediaPathForVideo(mediaRoot: string, videoId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) throw new MediaPolicyError("Invalid video identifier.");
  return `${mediaRoot.replace(/[\\/]$/, "")}/${videoId}.mp4`;
}

export function buildYtDlpArguments(videoUrl: string, outputTemplate: string): string[] {
  return [
    "--no-playlist",
    "--format",
    YTDLP_FORMAT_SELECTOR,
    "--merge-output-format",
    "mp4",
    "--no-part",
    "--newline",
    "--output",
    outputTemplate,
    videoUrl
  ];
}

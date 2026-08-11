import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BYTES,
  MAX_MEDIA_HEIGHT,
  YTDLP_FORMAT_SELECTOR,
  MediaPolicyError,
  assertDownloadedMediaPolicy,
  getEvictionPriority,
  orderEvictionCandidates,
  planEvictions
} from "@/domain/media-policy";
import type { EvictionCandidate } from "@/domain/types";

function candidate(overrides: Partial<EvictionCandidate>): EvictionCandidate {
  return {
    mediaId: "media-1", videoId: "video-1", bytes: 10, watchState: "unwatched", isPodcast: false,
    isPodcastProtected: false, isPinned: false, channelPruned: false, isTrial: false, isIgnored: false,
    recommendationScore: 0, lastAccessedAt: "2024-01-01T00:00:00.000Z", ...overrides
  };
}

describe("media policy", () => {
  it("centralizes a <=720p yt-dlp selector", () => {
    expect(YTDLP_FORMAT_SELECTOR).toContain("height<=720");
    expect(YTDLP_FORMAT_SELECTOR).not.toContain("height<=1080");
  });

  it("rejects oversized resolutions and media files", () => {
    expect(() => assertDownloadedMediaPolicy(100, MAX_MEDIA_HEIGHT + 1)).toThrow(MediaPolicyError);
    expect(() => assertDownloadedMediaPolicy(MAX_MEDIA_BYTES + 1, 720)).toThrow(MediaPolicyError);
    expect(() => assertDownloadedMediaPolicy(MAX_MEDIA_BYTES, 720)).not.toThrow();
  });

  it("orders evictions by policy and never includes protected media", () => {
    const watched = candidate({ mediaId: "watched", watchState: "watched" });
    const pruned = candidate({ mediaId: "pruned", channelPruned: true });
    const trial = candidate({ mediaId: "trial", isTrial: true });
    const normal = candidate({ mediaId: "normal", recommendationScore: 4 });
    const podcast = candidate({ mediaId: "podcast", isPodcast: true, isPodcastProtected: true });
    expect(orderEvictionCandidates([normal, podcast, trial, pruned, watched]).map((item) => item.mediaId)).toEqual(["watched", "pruned", "trial", "normal"]);
    expect(getEvictionPriority(podcast)).toBe(Infinity);
  });

  it("plans enough reclaimed bytes to stay below the normal target", () => {
    const plan = planEvictions(95, 15, [candidate({ mediaId: "a", bytes: 9, watchState: "watched" }), candidate({ mediaId: "b", bytes: 8, channelPruned: true })], 100);
    expect(plan.map((item) => item.mediaId)).toEqual(["a", "b"]);
    expect(plan.reduce((total, item) => total + item.bytes, 0)).toBeGreaterThanOrEqual(10);
  });
});


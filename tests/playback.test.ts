import { describe, expect, it } from "vitest";
import { selectNextPlaybackVideo } from "@/domain/playback";
import type { Video } from "@/domain/types";

function video(id: string, overrides: Partial<Video> = {}): Video {
  return {
    id,
    providerId: id,
    channelId: "channel-1",
    channelName: "Channel",
    title: id,
    description: null,
    thumbnailUrl: null,
    publishedAt: null,
    durationSeconds: 100,
    viewCount: 1,
    watchState: "unwatched",
    progressSeconds: 0,
    watchPercentage: 0,
    isTrial: false,
    isIgnored: false,
    isPinned: false,
    recommendationScore: 0,
    isPodcast: false,
    media: {
      id: `media-${id}`,
      videoId: id,
      path: `/media/${id}.mp4`,
      bytes: 100,
      height: 720,
      mimeType: "video/mp4",
      state: "ready",
      downloadedAt: null,
      lastAccessedAt: null
    },
    ...overrides
  };
}

describe("playback queue", () => {
  it("returns the first eligible candidate in repository order", () => {
    expect(selectNextPlaybackVideo([video("first"), video("second")], "current")?.id).toBe("first");
  });

  it("skips the current, watched, ignored, and unavailable videos", () => {
    const candidates = [
      video("current"),
      video("watched", { watchState: "watched" }),
      video("ignored", { isIgnored: true }),
      video("not-ready", { media: { ...video("media-source").media!, state: "downloading" } }),
      video("next")
    ];

    expect(selectNextPlaybackVideo(candidates, "current")?.id).toBe("next");
  });

  it("returns null when no local unwatched candidate remains", () => {
    expect(selectNextPlaybackVideo([video("watched", { watchState: "watched" })], "current")).toBeNull();
  });
});

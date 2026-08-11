import { describe, expect, it } from "vitest";
import { rankHomeVideos, scoreChannel } from "@/domain/recommendation";
import type { Channel, Video } from "@/domain/types";

function channel(id: string, watched: number): Channel {
  return {
    id, providerId: id, name: id, source: "initial_seed", isSubscribed: false, isRetained: false,
    isPruned: false, isPodcast: false, isPinned: false, videosPresented: watched * 2,
    videosOpened: watched * 2, videosWatched: watched, averagePercentageWatched: .75,
    recentEngagement: .7, lastInteractionAt: new Date().toISOString(), rejectionCount: 0
  };
}

function video(id: string, channelId: string, state: Video["watchState"] = "unwatched", trial = false): Video & { channelPreference: number } {
  return {
    id, providerId: id, channelId, channelName: channelId, title: id, thumbnailUrl: null, publishedAt: new Date().toISOString(),
    durationSeconds: 100, viewCount: 1000, watchState: state, progressSeconds: 0, watchPercentage: 0,
    isTrial: trial, isIgnored: false, isPinned: false, recommendationScore: 0, isPodcast: false, media: null, channelPreference: 1
  };
}

describe("recommendation behavior", () => {
  it("weights meaningful historical evidence above a single click", () => {
    expect(scoreChannel(channel("history", 30))).toBeGreaterThan(scoreChannel(channel("new", 1)));
  });

  it("keeps Home diverse and replenishes after watched items leave", () => {
    const videos = Array.from({ length: 50 }, (_, index) => video(`video-${index}`, `channel-${index % 5}`, index === 0 ? "watched" : "unwatched", index % 7 === 0));
    const first = rankHomeVideos(videos, 40);
    expect(first).toHaveLength(40);
    expect(new Set(first.map((item) => item.channelId)).size).toBeGreaterThan(1);
    const next = rankHomeVideos(videos.filter((item) => item.watchState !== "watched").map((item) => ({ ...item, watchState: item.id === "video-1" ? "watched" : item.watchState })), 40);
    expect(next).toHaveLength(40);
    expect(next.every((item) => item.watchState !== "watched")).toBe(true);
  });
});


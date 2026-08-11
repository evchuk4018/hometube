import { describe, expect, it } from "vitest";
import { isPodcastMediaProtected, podcastSections, shouldAutomaticallyDownloadPodcastEpisode, shouldDeleteCompletedPodcastMedia } from "@/domain/podcast";
import { buildTrialPool, shouldPruneTrial, shouldPromoteTrial } from "@/domain/trial";
import { deduplicateProviderVideos, mergeVideoMetadata, stableVideoIdentity } from "@/domain/sync";
import type { ProviderVideo, Video } from "@/domain/types";

const providerVideos: ProviderVideo[] = Array.from({ length: 12 }, (_, index) => ({ providerId: `provider-${index}`, channelProviderId: "channel", title: `Video ${index}`, durationSeconds: 10, viewCount: index }));

describe("trials, podcasts, and synchronization", () => {
  it("selects the ten most-viewed unwatched trial videos", () => {
    expect(buildTrialPool(providerVideos, new Set(["provider-11"]), 10)).toEqual(["provider-10", "provider-9", "provider-8", "provider-7", "provider-6", "provider-5", "provider-4", "provider-3", "provider-2", "provider-1"]);
  });

  it("promotes meaningful trial engagement and prunes ignored trials after expiry", () => {
    expect(shouldPromoteTrial({ videosPresented: 10, videosOpened: 5, videosWatched: 3, averagePercentageWatched: .5 })).toBe(true);
    expect(shouldPruneTrial({ trialEndsAt: new Date(Date.now() - 1000).toISOString(), isPinned: false, videosOpened: 0, videosWatched: 0, averagePercentageWatched: 0 })).toBe(true);
  });

  it("protects unfinished podcasts and allows completed media cleanup", () => {
    expect(isPodcastMediaProtected("unwatched")).toBe(true);
    expect(isPodcastMediaProtected("in_progress")).toBe(true);
    expect(shouldDeleteCompletedPodcastMedia("watched")).toBe(true);
    expect(podcastSections([{ watchState: "unwatched" }, { watchState: "in_progress" }, { watchState: "watched" }])).toEqual({ unwatched: [{ watchState: "unwatched" }], inProgress: [{ watchState: "in_progress" }], completed: [{ watchState: "watched" }] });
  });

  it("only automatically downloads podcast episodes published after activation", () => {
    const startedAt = "2026-08-01T00:00:00.000Z";
    expect(shouldAutomaticallyDownloadPodcastEpisode("2026-07-31T23:59:59.000Z", startedAt)).toBe(false);
    expect(shouldAutomaticallyDownloadPodcastEpisode("2026-08-01T00:00:00.000Z", startedAt)).toBe(false);
    expect(shouldAutomaticallyDownloadPodcastEpisode("2026-08-02T00:00:00.000Z", startedAt)).toBe(true);
    expect(shouldAutomaticallyDownloadPodcastEpisode(null, startedAt)).toBe(false);
    expect(shouldAutomaticallyDownloadPodcastEpisode("2026-08-02T00:00:00.000Z", null)).toBe(false);
  });

  it("preserves logical identity and watch/media state when metadata is rediscovered", () => {
    const existing: Video = {
      id: stableVideoIdentity("same"), providerId: "same", channelId: "channel", channelName: "Channel", title: "Old title", durationSeconds: 100,
      watchState: "watched", progressSeconds: 100, watchPercentage: 1, isTrial: false, isIgnored: false, isPinned: true, recommendationScore: 3, isPodcast: false,
      media: { id: "media", videoId: stableVideoIdentity("same"), path: "/srv/storage/hometube-media/same.mp4", bytes: 20, height: 720, mimeType: "video/mp4", state: "deleted" }
    };
    const merged = mergeVideoMetadata(existing, { providerId: "same", channelProviderId: "channel", title: "New title", durationSeconds: 120 }, "Channel", "channel");
    expect(merged.id).toBe(existing.id);
    expect(merged.watchState).toBe("watched");
    expect(merged.media?.state).toBe("deleted");
    expect(deduplicateProviderVideos([...providerVideos, providerVideos[0]])).toHaveLength(12);
  });
});

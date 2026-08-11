import { describe, expect, it } from "vitest";
import { isDownloadInProgress, isDownloadListed, sortDownloads } from "@/domain/downloads";
import type { MediaState, Video } from "@/domain/types";

function videoWithState(state: MediaState): Pick<Video, "media"> {
  return {
    media: {
      id: "media-1",
      videoId: "video-1",
      path: "",
      bytes: 0,
      height: 0,
      mimeType: "video/mp4",
      state
    }
  };
}

describe("download list states", () => {
  it("includes queued and active downloads", () => {
    expect(isDownloadListed(videoWithState("queued"))).toBe(true);
    expect(isDownloadListed(videoWithState("downloading"))).toBe(true);
    expect(isDownloadInProgress(videoWithState("queued"))).toBe(true);
    expect(isDownloadInProgress(videoWithState("downloading"))).toBe(true);
  });

  it("includes completed and actionable failures but excludes deleted media", () => {
    expect(isDownloadListed(videoWithState("ready"))).toBe(true);
    expect(isDownloadListed(videoWithState("failed"))).toBe(true);
    expect(isDownloadListed(videoWithState("unavailable"))).toBe(true);
    expect(isDownloadListed(videoWithState("deleted"))).toBe(false);
    expect(isDownloadInProgress(videoWithState("ready"))).toBe(false);
  });

  it("sorts ready downloads before active and failed downloads", () => {
    const states: MediaState[] = ["failed", "queued", "ready", "downloading"];
    expect(sortDownloads(states.map((state) => videoWithState(state))).map((video) => video.media?.state)).toEqual(["ready", "downloading", "queued", "failed"]);
  });
});

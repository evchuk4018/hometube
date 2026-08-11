import { describe, expect, it } from "vitest";
import { safeYouTubeThumbnailUrl, thumbnailUrlForVideo, youtubeThumbnailUrl } from "@/domain/thumbnails";

describe("thumbnail URLs", () => {
  it("accepts approved YouTube thumbnail URLs", () => {
    const url = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    expect(safeYouTubeThumbnailUrl(url)).toBe(url);
    expect(thumbnailUrlForVideo(url, "unused-id")).toBe(url);
  });

  it("rejects non-YouTube or insecure URLs", () => {
    expect(safeYouTubeThumbnailUrl("http://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")).toBeNull();
    expect(safeYouTubeThumbnailUrl("https://example.com/thumbnail.jpg")).toBeNull();
  });

  it("falls back to YouTube's standard thumbnail URL", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(thumbnailUrlForVideo(null, "dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(youtubeThumbnailUrl("not-a-video-id")).toBeNull();
  });
});

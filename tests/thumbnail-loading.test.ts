import { describe, expect, it } from "vitest";
import { shouldPreloadThumbnail, THUMBNAIL_PRELOAD_COUNT } from "@/app/components/thumbnail-loading";

describe("thumbnail loading order", () => {
  it("preloads only the first three thumbnails in list order", () => {
    expect(THUMBNAIL_PRELOAD_COUNT).toBe(3);
    expect([0, 1, 2].map(shouldPreloadThumbnail)).toEqual([true, true, true]);
    expect(shouldPreloadThumbnail(3)).toBe(false);
  });

  it("does not preload invalid positions", () => {
    expect(shouldPreloadThumbnail(-1)).toBe(false);
    expect(shouldPreloadThumbnail(1.5)).toBe(false);
  });
});

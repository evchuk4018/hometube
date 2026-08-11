import { describe, expect, it, vi } from "vitest";
import { cancelDownload, cancelQueuedPodcastDownloads } from "@/server/repositories/download-repository";
import { query } from "@/server/db";

vi.mock("@/server/db", () => ({ query: vi.fn() }));

describe("podcast download cancellation", () => {
  it("deletes queued podcast jobs and marks their queued media deleted", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rowCount: 4, rows: [], command: "UPDATE", oid: 0, fields: [] });

    await expect(cancelQueuedPodcastDownloads("channel-1")).resolves.toBe(4);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("j.kind = 'podcast'"), ["channel-1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("j.status = 'queued'"), ["channel-1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("state = 'deleted'"), ["channel-1"]);
  });

  it("cancels queued or active video downloads and returns the temporary path", async () => {
    vi.mocked(query).mockResolvedValueOnce({ rowCount: 1, rows: [{ path: "/media/.download-video-1.part.mp4" }], command: "UPDATE", oid: 0, fields: [] });

    await expect(cancelDownload("video-1")).resolves.toEqual({ cancelled: true, path: "/media/.download-video-1.part.mp4" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled'"), ["video-1"]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("state IN ('queued', 'downloading')"), ["video-1"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { cancelQueuedPodcastDownloads } from "@/server/repositories/download-repository";
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
});

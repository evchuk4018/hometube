import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueDownload } from "@/server/repositories/download-repository";

const { clientQuery } = vi.hoisted(() => ({ clientQuery: vi.fn() }));

vi.mock("@/server/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (callback: (client: { query: typeof clientQuery }) => Promise<unknown>) => callback({ query: clientQuery }))
}));

describe("download priority", () => {
  beforeEach(() => {
    clientQuery.mockReset();
    clientQuery.mockResolvedValue({ rowCount: 0, rows: [], command: "UPDATE", oid: 0, fields: [] });
  });

  it("gives manual requests highest priority and preempts active background work", async () => {
    await enqueueDownload("video-manual", "manual");

    expect(clientQuery).toHaveBeenCalledTimes(3);
    expect(clientQuery.mock.calls[1]?.[1]).toEqual(["video-manual", "manual", 300]);
    expect(clientQuery.mock.calls[2]?.[0]).toEqual(expect.stringContaining("kind IN ('auto', 'podcast')"));
    expect(clientQuery.mock.calls[2]?.[0]).toEqual(expect.stringContaining("status = 'cancelled'"));
  });

  it("does not interrupt background work when the worker enqueues a background job", async () => {
    await enqueueDownload("video-auto", "auto");

    expect(clientQuery).toHaveBeenCalledTimes(2);
    expect(clientQuery.mock.calls[1]?.[1]).toEqual(["video-auto", "auto", 0]);
  });
});

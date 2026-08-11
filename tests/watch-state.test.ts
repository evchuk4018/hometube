import { describe, expect, it } from "vitest";
import { progressUpdate, stateFromProgress } from "@/domain/watch-state";

describe("watch state", () => {
  it("moves from unwatched to in progress to watched at the configured threshold", () => {
    expect(stateFromProgress(0, 100, 0.9)).toBe("unwatched");
    expect(stateFromProgress(40, 100, 0.9)).toBe("in_progress");
    expect(stateFromProgress(90, 100, 0.9)).toBe("watched");
  });

  it("persists a manual state and clamps progress", () => {
    expect(progressUpdate({ positionSeconds: 140, durationSeconds: 100, manualState: "watched" })).toEqual({ state: "watched", positionSeconds: 100, watchPercentage: 1 });
    expect(progressUpdate({ positionSeconds: -1, durationSeconds: 100 })).toEqual({ state: "unwatched", positionSeconds: 0, watchPercentage: 0 });
  });
});


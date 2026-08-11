import { describe, expect, it } from "vitest";
import { initialChannels } from "@/server/seed/initial-channels";

describe("initial seed catalog", () => {
  it("ships roughly one hundred unique stable channel identities", () => {
    expect(initialChannels.length).toBeGreaterThanOrEqual(100);
    expect(new Set(initialChannels.map((channel) => channel.providerId)).size).toBe(initialChannels.length);
  });
});


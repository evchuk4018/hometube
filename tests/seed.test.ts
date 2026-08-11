import { describe, expect, it } from "vitest";
import { initialChannels } from "@/server/seed/initial-channels";
import { screenshotChannels } from "@/server/seed/screenshot-channels";

describe("initial seed catalog", () => {
  it("ships roughly one hundred unique stable channel identities", () => {
    expect(initialChannels.length).toBeGreaterThanOrEqual(100);
    expect(new Set(initialChannels.map((channel) => channel.providerId)).size).toBe(initialChannels.length);
  });

  it("includes the screenshot-inspired channels", () => {
    const names = new Set(initialChannels.map((channel) => channel.name));
    for (const channel of screenshotChannels) expect(names.has(channel.name)).toBe(true);
    expect(names.has("Atrioc")).toBe(true);
    expect(names.has("How Money Works")).toBe(true);
    expect(names.has("Lemonade Stand")).toBe(true);
  });
});

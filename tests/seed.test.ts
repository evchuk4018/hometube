import { describe, expect, it } from "vitest";
import { initialChannels, relatedChannels } from "@/server/seed/initial-channels";
import { screenshotChannels } from "@/server/seed/screenshot-channels";

describe("initial seed catalog", () => {
  it("ships a compact screenshot-biased catalog of unique stable channel identities", () => {
    expect(initialChannels).toHaveLength(30);
    expect(new Set(initialChannels.map((channel) => channel.providerId)).size).toBe(initialChannels.length);
    expect(screenshotChannels.length).toBeGreaterThan(relatedChannels.length);
  });

  it("includes the screenshot-inspired channels", () => {
    const names = new Set(initialChannels.map((channel) => channel.name));
    for (const channel of screenshotChannels) expect(names.has(channel.name)).toBe(true);
    expect(names.has("Atrioc")).toBe(true);
    expect(names.has("How Money Works")).toBe(true);
    expect(names.has("Lemonade Stand")).toBe(true);
    expect(names.has("CGP Grey")).toBe(true);
    expect(names.has("Marques Brownlee")).toBe(true);
  });

  it("includes Fireship and avoids the removed broad preseed", () => {
    const names = new Set(initialChannels.map((channel) => channel.name));
    expect(names.has("Fireship")).toBe(true);
    expect(names.has("The Guardian")).toBe(false);
    expect(names.has("Vox")).toBe(false);
    expect(names.has("Lofi Girl")).toBe(false);
  });
});

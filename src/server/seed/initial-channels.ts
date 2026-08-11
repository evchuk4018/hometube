import { screenshotChannels } from "./screenshot-channels";
import type { SeedChannel } from "./types";

export type { SeedChannel } from "./types";

/**
 * A small set of adjacent channels selected from the interests represented in
 * the screenshots: technology, business, explanatory video, and commentary.
 * The screenshot channels intentionally remain the majority of the catalog.
 */
export const relatedChannels: SeedChannel[] = [
  { providerId: "@Fireship", name: "Fireship", handle: "@Fireship" },
  { providerId: "@ThePrimeTimeagen", name: "ThePrimeTime", handle: "@ThePrimeTimeagen" },
  { providerId: "@t3dotgg", name: "Theo - t3.gg", handle: "@t3dotgg" },
  { providerId: "@TomScottGo", name: "Tom Scott", handle: "@TomScottGo" },
  { providerId: "@Wendoverproductions", name: "Wendover Productions", handle: "@Wendoverproductions" },
  { providerId: "@PracticalEngineeringChannel", name: "Practical Engineering", handle: "@PracticalEngineeringChannel" },
  { providerId: "@veritasium", name: "Veritasium", handle: "@veritasium" },
  { providerId: "@pboyle", name: "Patrick Boyle", handle: "@pboyle" },
  { providerId: "@johnnyharris", name: "Johnny Harris", handle: "@johnnyharris" },
  { providerId: "@technologyconnections", name: "Technology Connections", handle: "@technologyconnections" },
  { providerId: "@computerphile", name: "Computerphile", handle: "@computerphile" }
];

export const initialChannels: SeedChannel[] = [...screenshotChannels, ...relatedChannels];

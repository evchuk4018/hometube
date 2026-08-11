import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8")
) as { start_url: string; scope: string; icons: Array<{ src: string }> };

describe("PWA manifest", () => {
  it("keeps the installed app inside the path where the manifest is served", () => {
    const rootManifestUrl = new URL("https://example.test/manifest.webmanifest");
    const mountedManifestUrl = new URL("https://example.test/hometube/manifest.webmanifest");

    expect(new URL(manifest.start_url, rootManifestUrl).pathname).toBe("/");
    expect(new URL(manifest.start_url, mountedManifestUrl).pathname).toBe("/hometube/");
    expect(new URL(manifest.scope, mountedManifestUrl).pathname).toBe("/hometube/");
    expect(new URL(manifest.icons[0].src, mountedManifestUrl).pathname).toBe("/hometube/icon.svg");
  });
});

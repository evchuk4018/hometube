import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import type { ProviderVideo } from "@/domain/types";
import { buildYtDlpArguments, validateFormatCandidate } from "@/domain/media-policy";
import { appConfig } from "../config";
import type { DownloadResult, VideoProvider } from "./video-provider";

type JsonEntry = {
  id?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  upload_date?: string;
  timestamp?: number;
  duration?: number;
  view_count?: number;
  channel_id?: string;
  webpage_url?: string;
};

function run(binary: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${binary} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

function channelUrl(providerChannelId: string): string {
  if (/^https?:\/\//.test(providerChannelId)) return providerChannelId;
  if (providerChannelId.startsWith("@")) return `https://www.youtube.com/${providerChannelId}/videos`;
  return `https://www.youtube.com/channel/${encodeURIComponent(providerChannelId)}/videos`;
}

function videoUrl(providerVideoId: string): string {
  if (/^https?:\/\//.test(providerVideoId)) return providerVideoId;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(providerVideoId)}`;
}

function parsePublishedAt(entry: JsonEntry): string | null {
  if (entry.timestamp) return new Date(entry.timestamp * 1000).toISOString();
  if (entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
    const date = `${entry.upload_date.slice(0, 4)}-${entry.upload_date.slice(4, 6)}-${entry.upload_date.slice(6, 8)}T00:00:00.000Z`;
    return new Date(date).toISOString();
  }
  return null;
}

export class YtDlpProvider implements VideoProvider {
  private readonly binary: string;

  constructor(binary = process.env.YTDLP_BINARY ?? "yt-dlp") {
    this.binary = binary;
  }

  async listChannelVideos(providerChannelId: string): Promise<ProviderVideo[]> {
    const args = ["--flat-playlist", "--dump-single-json", "--no-warnings"];
    if (appConfig.youtubeCookieFile) args.push("--cookies", appConfig.youtubeCookieFile);
    args.push(channelUrl(providerChannelId));
    const { stdout } = await run(this.binary, args);
    const payload = JSON.parse(stdout) as { entries?: JsonEntry[] };
    return (payload.entries ?? []).filter((entry) => entry.id && entry.title).map((entry) => ({
      providerId: String(entry.id),
      channelProviderId: entry.channel_id ?? providerChannelId,
      title: String(entry.title),
      description: entry.description ?? null,
      thumbnailUrl: entry.thumbnail ?? null,
      publishedAt: parsePublishedAt(entry),
      durationSeconds: Math.max(0, Math.round(entry.duration ?? 0)),
      viewCount: entry.view_count ?? null
    }));
  }

  async downloadVideo(providerVideoId: string, outputPath: string): Promise<DownloadResult> {
    const args = buildYtDlpArguments(videoUrl(providerVideoId), outputPath);
    if (appConfig.youtubeCookieFile) args.splice(0, 0, "--cookies", appConfig.youtubeCookieFile);
    await run(this.binary, args);
    const stats = await fs.stat(outputPath);
    const height = await this.probeHeight(outputPath);
    validateFormatCandidate({ height, filesize: stats.size });
    return { path: outputPath, bytes: stats.size, height, mimeType: "video/mp4" };
  }

  async downloadThumbnail(thumbnailUrl: string, outputPath: string): Promise<void> {
    const parsed = new URL(thumbnailUrl);
    if (parsed.protocol !== "https:" || !["i.ytimg.com", "yt3.ggpht.com", "yt3.googleusercontent.com"].includes(parsed.hostname)) {
      throw new Error("Thumbnail URL is not an approved YouTube image URL.");
    }
    const response = await fetch(parsed);
    if (!response.ok || !response.body) throw new Error(`Thumbnail request failed with status ${response.status}.`);
    const file = await fs.open(outputPath, "w");
    try {
      const reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        await file.write(chunk.value);
      }
    } finally {
      await file.close();
    }
  }

  private async probeHeight(filePath: string): Promise<number> {
    const { stdout } = await run(process.env.FFPROBE_BINARY ?? "ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "json", filePath
    ]);
    const payload = JSON.parse(stdout) as { streams?: Array<{ height?: number }> };
    const height = Number(payload.streams?.[0]?.height ?? 0);
    if (!Number.isInteger(height) || height < 1) throw new Error("ffprobe could not determine the downloaded video height.");
    return height;
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { assertDownloadedMediaPolicy, planEvictions } from "@/domain/media-policy";
import { appConfig } from "../config";
import { findVideoById } from "../repositories/video-repository";
import { currentMediaBytes, listEvictionCandidates, listCompletedPodcastMedia, markMediaState, deleteMediaRecord } from "../repositories/media-repository";
import { enqueueDownload, claimNextDownload, finishDownload, type DownloadJob } from "../repositories/download-repository";
import { ensureMediaRoot, removePhysicalMedia } from "./media-service";
import type { VideoProvider } from "../providers/video-provider";

export async function requestDownload(videoId: string, kind: DownloadJob["kind"] = "manual"): Promise<void> {
  const video = await findVideoById(videoId);
  if (!video) throw new Error("Video not found.");
  await enqueueDownload(videoId, kind);
}

async function evictForIncoming(incomingBytes: number): Promise<void> {
  const currentBytes = await currentMediaBytes();
  const candidates = await listEvictionCandidates();
  const plan = planEvictions(currentBytes, incomingBytes, candidates, appConfig.mediaTargetBytes);
  for (const candidate of plan) {
    const media = candidates.find((entry) => entry.mediaId === candidate.mediaId);
    if (!media) continue;
    const row = await deleteMediaRecord(media.videoId);
    if (row) await removePhysicalMedia(row.path);
  }
}

export async function processOneDownload(provider: VideoProvider): Promise<boolean> {
  const job = await claimNextDownload();
  if (!job) return false;
  const video = await findVideoById(job.videoId);
  if (!video) {
    await finishDownload(job.id, "unavailable", "Video metadata no longer exists.");
    return true;
  }
  await ensureMediaRoot();
  const tempPath = path.join(appConfig.mediaRoot, `.download-${video.id}.part.mp4`);
  try {
    await markMediaState(video.id, "downloading", { path: tempPath });
    const result = await provider.downloadVideo(video.providerId, tempPath);
    assertDownloadedMediaPolicy(result.bytes, result.height);
    await evictForIncoming(result.bytes);
    const finalPath = path.join(appConfig.mediaRoot, `${video.id}.mp4`);
    await fs.rename(result.path, finalPath);
    await markMediaState(video.id, "ready", { path: finalPath, bytes: result.bytes, height: result.height, mimeType: result.mimeType });
    await finishDownload(job.id, "ready");
  } catch (error) {
    await removePhysicalMedia(tempPath);
    await markMediaState(video.id, "failed", { error: error instanceof Error ? error.message : "Download failed." });
    await finishDownload(job.id, "failed", error instanceof Error ? error.message : "Download failed.");
  }
  return true;
}

export async function cleanupCache(): Promise<number> {
  let removed = 0;
  for (const candidate of await listCompletedPodcastMedia()) {
    const row = await deleteMediaRecord(candidate.videoId);
    if (row) {
      await removePhysicalMedia(row.path);
      removed += 1;
    }
  }
  const current = await currentMediaBytes();
  if (current <= appConfig.mediaTargetBytes) return removed;
  const candidates = await listEvictionCandidates();
  const plan = planEvictions(current, 0, candidates, appConfig.mediaTargetBytes);
  for (const candidate of plan) {
    const row = await deleteMediaRecord(candidate.videoId);
    if (row) await removePhysicalMedia(row.path);
  }
  return removed + plan.length;
}

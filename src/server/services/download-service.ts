import { promises as fs } from "node:fs";
import path from "node:path";
import { assertDownloadedMediaPolicy, planEvictions } from "@/domain/media-policy";
import { appConfig } from "../config";
import { findVideoById } from "../repositories/video-repository";
import { currentMediaBytes, listEvictionCandidates, listCompletedPodcastMedia, markMediaState, deleteMediaRecord } from "../repositories/media-repository";
import { enqueueDownload, claimNextDownload, completeDownload, finishDownload, isDownloadCancelled, cancelDownload as cancelDownloadJob, type DownloadJob } from "../repositories/download-repository";
import { ensureMediaRoot, expectedThumbnailPath, removeLocalVideoAssets, removePhysicalMedia } from "./media-service";
import type { VideoProvider } from "../providers/video-provider";

export async function requestDownload(videoId: string, kind: DownloadJob["kind"] = "manual"): Promise<void> {
  const video = await findVideoById(videoId);
  if (!video) throw new Error("Video not found.");
  if (video.media?.state === "ready") return;
  await enqueueDownload(videoId, kind);
}

export async function cancelDownload(videoId: string): Promise<void> {
  const result = await cancelDownloadJob(videoId);
  if (result.path) await removePhysicalMedia(result.path);
}

async function evictForIncoming(incomingBytes: number): Promise<void> {
  const currentBytes = await currentMediaBytes();
  const candidates = await listEvictionCandidates();
  const plan = planEvictions(currentBytes, incomingBytes, candidates, appConfig.mediaTargetBytes);
  for (const candidate of plan) {
    const media = candidates.find((entry) => entry.mediaId === candidate.mediaId);
    if (!media) continue;
    const row = await deleteMediaRecord(media.videoId);
    if (row) await removeLocalVideoAssets(media.videoId, row.path);
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
  const controller = new AbortController();
  const cancellationPoll = setInterval(() => {
    void isDownloadCancelled(job.id).then((cancelled) => { if (cancelled) controller.abort(); });
  }, 1000);
  try {
    await markMediaState(video.id, "downloading", { path: tempPath });
    const result = await provider.downloadVideo(video.providerId, tempPath, controller.signal);
    if (controller.signal.aborted || await isDownloadCancelled(job.id)) throw new Error("Download cancelled.");
    assertDownloadedMediaPolicy(result.bytes, result.height);
    await evictForIncoming(result.bytes);
    const finalPath = path.join(appConfig.mediaRoot, `${video.id}.mp4`);
    await fs.rename(result.path, finalPath);
    if (video.thumbnailUrl) {
      try {
        await provider.downloadThumbnail(video.thumbnailUrl, expectedThumbnailPath(video.id));
      } catch (error) {
        console.warn(`Could not cache thumbnail for ${video.id}:`, error);
      }
    }
    const completed = await completeDownload({ jobId: job.id, videoId: video.id, path: finalPath, bytes: result.bytes, height: result.height, mimeType: result.mimeType });
    if (!completed) {
      await removePhysicalMedia(finalPath);
      throw new Error("Download cancelled.");
    }
  } catch (error) {
    await removePhysicalMedia(tempPath);
    if (controller.signal.aborted || await isDownloadCancelled(job.id)) {
      await markMediaState(video.id, "deleted");
    } else {
      await markMediaState(video.id, "failed", { error: error instanceof Error ? error.message : "Download failed." });
      await finishDownload(job.id, "failed", error instanceof Error ? error.message : "Download failed.");
    }
  } finally {
    clearInterval(cancellationPoll);
  }
  return true;
}

export async function cleanupCache(): Promise<number> {
  let removed = 0;
  for (const candidate of await listCompletedPodcastMedia()) {
    const row = await deleteMediaRecord(candidate.videoId);
    if (row) {
      await removeLocalVideoAssets(candidate.videoId, row.path);
      removed += 1;
    }
  }
  const current = await currentMediaBytes();
  if (current <= appConfig.mediaTargetBytes) return removed;
  const candidates = await listEvictionCandidates();
  const plan = planEvictions(current, 0, candidates, appConfig.mediaTargetBytes);
  for (const candidate of plan) {
    const row = await deleteMediaRecord(candidate.videoId);
    if (row) await removeLocalVideoAssets(candidate.videoId, row.path);
  }
  return removed + plan.length;
}

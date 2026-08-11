import { progressUpdate } from "@/domain/watch-state";
import { appConfig } from "../config";
import { recordChannelEngagement } from "../repositories/channel-repository";
import { deleteMediaRecord, findReadyMedia } from "../repositories/media-repository";
import { enqueueDownload } from "../repositories/download-repository";
import { findVideoById, updateVideoPinned, updateVideoProgress } from "../repositories/video-repository";
import { recordWatchEvent } from "../repositories/watch-event-repository";
import { removeLocalVideoAssets } from "./media-service";
import type { VideoAction } from "../validation";

export async function performVideoAction(videoId: string, action: VideoAction) {
  const video = await findVideoById(videoId);
  if (!video) return null;
  if (action === "watched" || action === "unwatched") {
    const update = progressUpdate({
      positionSeconds: action === "watched" ? Math.max(video.progressSeconds, video.durationSeconds) : 0,
      durationSeconds: video.durationSeconds,
      completionThreshold: appConfig.completionThreshold,
      manualState: action
    });
    const updated = await updateVideoProgress({ id: videoId, ...update });
    await recordChannelEngagement({ channelId: video.channelId, watched: action === "watched", percentage: update.watchPercentage });
    await recordWatchEvent({ videoId, eventType: "manual", positionSeconds: update.positionSeconds, watchPercentage: update.watchPercentage });
    return updated;
  }
  if (action === "pin" || action === "unpin") return updateVideoPinned(videoId, action === "pin");
  if (action === "download") {
    await enqueueDownload(videoId, video.isPodcast ? "podcast" : "manual");
    return findVideoById(videoId);
  }
  const media = await findReadyMedia(videoId);
  if (media) {
    await removeLocalVideoAssets(videoId, media.path);
    await deleteMediaRecord(videoId);
  }
  return findVideoById(videoId);
}

export async function recordProgress(input: { videoId: string; positionSeconds: number; durationSeconds: number; manualState?: "watched" | "unwatched" }) {
  const video = await findVideoById(input.videoId);
  if (!video) return null;
  const update = progressUpdate({ ...input, completionThreshold: appConfig.completionThreshold });
  const updated = await updateVideoProgress({ id: input.videoId, ...update });
  const newlyOpened = video.watchState === "unwatched" && update.positionSeconds > 0;
  const newlyWatched = video.watchState !== "watched" && update.state === "watched";
  if (newlyOpened || newlyWatched) await recordChannelEngagement({ channelId: video.channelId, opened: newlyOpened, watched: newlyWatched, percentage: update.watchPercentage });
  await recordWatchEvent({ videoId: input.videoId, eventType: newlyWatched ? "watched" : "progress", positionSeconds: update.positionSeconds, watchPercentage: update.watchPercentage });
  return updated;
}

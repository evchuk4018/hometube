import { appConfig } from "../config";
import { listChannels, listPodcastChannels } from "../repositories/channel-repository";
import { promoteTrialChannel, setChannelPruned } from "../repositories/channel-repository";
import { enqueueDownload } from "../repositories/download-repository";
import { upsertVideo } from "../repositories/video-repository";
import type { VideoProvider } from "../providers/video-provider";
import { shouldPruneTrial, shouldPromoteTrial } from "@/domain/trial";

export async function syncChannel(channel: { id: string; providerId: string; isPodcast: boolean }, provider: VideoProvider): Promise<number> {
  const providerVideos = await provider.listChannelVideos(channel.providerId);
  let added = 0;
  for (const providerVideo of providerVideos) {
    const video = await upsertVideo(channel.id, providerVideo);
    if (channel.isPodcast && !video.media) await enqueueDownload(video.id, "podcast");
    added += 1;
  }
  return added;
}

export async function syncPodcastCatalog(provider: VideoProvider): Promise<number> {
  const channels = await listPodcastChannels();
  let total = 0;
  for (const channel of channels) total += await syncChannel(channel, provider);
  return total;
}

export async function syncAllCatalog(provider: VideoProvider): Promise<number> {
  const channels = await listChannels();
  let total = 0;
  for (const channel of channels) total += await syncChannel(channel, provider);
  return total;
}

export function shouldRunCatalogSync(lastRun: number | null, now = Date.now()): boolean {
  return lastRun == null || now - lastRun >= appConfig.catalogSyncHours * 3_600_000;
}

export async function evaluateTrials(): Promise<void> {
  for (const channel of await listChannels()) {
    if (!channel.trialEndsAt) continue;
    if (shouldPromoteTrial(channel)) await promoteTrialChannel(channel.id);
    else if (shouldPruneTrial({ ...channel, isPinned: channel.isPinned, videosOpened: channel.videosOpened, videosWatched: channel.videosWatched, averagePercentageWatched: channel.averagePercentageWatched })) await setChannelPruned(channel.id, true);
  }
}

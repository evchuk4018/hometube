import { appConfig } from "../config";
import { listChannels, listPodcastChannels } from "../repositories/channel-repository";
import { promoteTrialChannel, setChannelPruned } from "../repositories/channel-repository";
import { enqueueDownload } from "../repositories/download-repository";
import { upsertVideo } from "../repositories/video-repository";
import type { VideoProvider } from "../providers/video-provider";
import { shouldPruneTrial, shouldPromoteTrial } from "@/domain/trial";
import { listFeedVideoRows } from "../repositories/video-repository";
import { mapVideoRow } from "../row-mappers";
import { rankHomeVideos, scoreChannel } from "@/domain/recommendation";

export async function syncChannel(channel: { id: string; providerId: string; isPodcast: boolean }, provider: VideoProvider): Promise<number> {
  const providerVideos = await provider.listChannelVideos(channel.providerId);
  let added = 0;
  for (const providerVideo of providerVideos) {
    const video = await upsertVideo(channel.id, providerVideo);
    if (channel.isPodcast && video.media?.state !== "ready" && video.media?.state !== "queued" && video.media?.state !== "downloading") await enqueueDownload(video.id, "podcast");
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

export async function queueNormalRecommendations(): Promise<number> {
  const rows = await listFeedVideoRows();
  const ranked = rankHomeVideos(rows.map((row) => ({
    ...mapVideoRow(row),
    channelPreference: scoreChannel({
      videosPresented: Number(row.channel_videos_presented ?? 0),
      videosOpened: Number(row.channel_videos_opened ?? 0),
      videosWatched: Number(row.channel_videos_watched ?? 0),
      averagePercentageWatched: Number(row.channel_average_percentage_watched ?? 0),
      recentEngagement: Number(row.channel_recent_engagement ?? 0),
      lastInteractionAt: row.channel_last_interaction_at ? String(row.channel_last_interaction_at) : null,
      isRetained: row.channel_is_retained === true,
      isPinned: row.channel_is_pinned === true,
      isPruned: row.channel_is_pruned === true,
      isPodcast: row.is_podcast === true,
      source: row.channel_source as Parameters<typeof scoreChannel>[0]["source"]
    })
  })), appConfig.autoDownloadCount);
  let queued = 0;
  for (const video of ranked) {
    if (video.isPodcast || video.media?.state === "ready" || video.media?.state === "queued" || video.media?.state === "downloading") continue;
    await enqueueDownload(video.id, "auto");
    queued += 1;
  }
  return queued;
}

export function shouldRunCatalogSync(lastRun: number | null, now = Date.now()): boolean {
  return lastRun == null || now - lastRun >= appConfig.catalogSyncHours * 3_600_000;
}

export async function evaluateTrials(): Promise<void> {
  for (const channel of await listChannels()) {
    if (!channel.trialEndsAt || channel.isPodcast) continue;
    if (shouldPromoteTrial(channel)) await promoteTrialChannel(channel.id);
    else if (shouldPruneTrial({ ...channel, isPinned: channel.isPinned, videosOpened: channel.videosOpened, videosWatched: channel.videosWatched, averagePercentageWatched: channel.averagePercentageWatched })) await setChannelPruned(channel.id, true);
  }
}

import { appConfig } from "../config";
import { createChannel, findChannelById, removeChannelFromRecommendations, setChannelPinned, setChannelPruned, setChannelRetention, setPodcastMode as setPodcastModeRecord } from "../repositories/channel-repository";
import { cancelQueuedPodcastBacklog } from "../repositories/download-repository";
import { deleteReadyMediaForChannel } from "../repositories/media-repository";
import { createChannelSchema } from "../validation";
import { removeLocalVideoAssets } from "./media-service";

export async function addChannel(input: unknown) {
  const parsed = createChannelSchema.parse(input);
  return createChannel(parsed);
}

export async function performChannelAction(channelId: string, action: "retain" | "unretain" | "prune" | "unprune" | "remove" | "restore" | "podcast" | "normal") {
  if (action === "retain") return setChannelRetention(channelId, true);
  if (action === "unretain") return setChannelRetention(channelId, false);
  if (action === "prune") return setChannelPruned(channelId, true);
  if (action === "unprune") return setChannelPruned(channelId, false);
  if (action === "remove") return removeChannelFromRecommendations(channelId, false);
  if (action === "restore") return removeChannelFromRecommendations(channelId, true);
  if (action === "podcast") return enablePodcastMode(channelId);
  return setPodcastModeRecord(channelId, false);
}

async function enablePodcastMode(channelId: string) {
  const channel = await setPodcastModeRecord(channelId, true);
  if (!channel) return null;
  if (channel.podcastStartedAt) await cancelQueuedPodcastBacklog(channel.id, channel.podcastStartedAt);
  for (const media of await deleteReadyMediaForChannel(channel.id)) await removeLocalVideoAssets(media.videoId, media.path);
  return channel;
}

export async function pinChannel(channelId: string, pinned: boolean) {
  return setChannelPinned(channelId, pinned);
}

export function trialEndDate(): Date {
  return new Date(Date.now() + appConfig.trialDays * 86_400_000);
}

export { findChannelById };

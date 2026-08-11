import { appConfig } from "../config";
import { createChannel, findChannelById, setChannelPinned, setChannelPruned, setChannelRetention, setPodcastMode } from "../repositories/channel-repository";
import { createChannelSchema } from "../validation";

export async function addChannel(input: unknown) {
  const parsed = createChannelSchema.parse(input);
  return createChannel(parsed);
}

export async function performChannelAction(channelId: string, action: "retain" | "unretain" | "prune" | "unprune" | "podcast" | "normal") {
  if (action === "retain") return setChannelRetention(channelId, true);
  if (action === "unretain") return setChannelRetention(channelId, false);
  if (action === "prune") return setChannelPruned(channelId, true);
  if (action === "unprune") return setChannelPruned(channelId, false);
  if (action === "podcast") return setPodcastMode(channelId, true);
  return setPodcastMode(channelId, false);
}

export async function pinChannel(channelId: string, pinned: boolean) {
  return setChannelPinned(channelId, pinned);
}

export function trialEndDate(): Date {
  return new Date(Date.now() + appConfig.trialDays * 86_400_000);
}

export { findChannelById };

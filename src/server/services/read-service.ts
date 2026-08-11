import type { Channel, FeedVideo, Video } from "@/domain/types";
import { podcastSections } from "@/domain/podcast";
import { rankHomeVideos, scoreChannel } from "@/domain/recommendation";
import { appConfig, hasDatabase } from "../config";
import { mapVideoRow } from "../row-mappers";
import { listChannels, findChannelById, listPodcastChannels, recordChannelPresentation } from "../repositories/channel-repository";
import { listDownloadVideos, listFeedVideoRows, listPodcastEpisodes, listVideosByChannel } from "../repositories/video-repository";
import { replaceActiveRecommendations } from "../repositories/recommendation-repository";

function demoChannel(id: string, name: string, source: Channel["source"], podcast = false): Channel {
  return {
    id,
    providerId: id,
    name,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
    description: "A channel in the HomeTube demo catalog.",
    thumbnailUrl: null,
    source,
    isSubscribed: source === "user_added",
    isRetained: source !== "ai_recommendation",
    isPruned: false,
    isPodcast: podcast,
    isPinned: false,
    trialStartedAt: source === "ai_recommendation" ? new Date(Date.now() - 86_400_000).toISOString() : null,
    trialEndsAt: null,
    videosPresented: source === "user_added" ? 12 : 4,
    videosOpened: source === "user_added" ? 8 : 2,
    videosWatched: source === "user_added" ? 5 : 1,
    averagePercentageWatched: source === "user_added" ? 0.68 : 0.42,
    recentEngagement: source === "user_added" ? 0.8 : 0.25,
    lastInteractionAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    rejectionCount: 0,
    lastRejectionReason: null,
    lastAiJustification: source === "ai_recommendation" ? "Matches the strongest channels in the current preference profile." : null
  };
}

function demoVideo(id: string, channel: Channel, title: string, index: number, state: Video["watchState"] = "unwatched"): Video {
  return {
    id,
    providerId: id,
    channelId: channel.id,
    channelName: channel.name,
    title,
    description: "Demo metadata. Connect PostgreSQL and run the seed command to populate your catalog.",
    thumbnailUrl: null,
    publishedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    durationSeconds: 900 + index * 120,
    viewCount: 100_000 - index * 2_000,
    watchState: state,
    progressSeconds: state === "in_progress" ? 390 : state === "watched" ? 1200 : 0,
    watchPercentage: state === "in_progress" ? 0.42 : state === "watched" ? 1 : 0,
    isTrial: channel.source === "ai_recommendation",
    isIgnored: false,
    isPinned: false,
    recommendationScore: 0,
    isPodcast: channel.isPodcast,
    media: null
  };
}

function demoData(): { channels: Channel[]; videos: Video[] } {
  const channels = [
    demoChannel("demo-science", "Field Notes", "user_added"),
    demoChannel("demo-culture", "Signal & Story", "initial_seed"),
    demoChannel("demo-podcast", "Longform Radio", "podcast", true),
    demoChannel("demo-trial", "New Perspective", "ai_recommendation")
  ];
  const videos = channels.flatMap((channel, channelIndex) => Array.from({ length: channel.isPodcast ? 5 : 4 }, (_, index) => demoVideo(`${channel.id}-${index + 1}`, channel, `${channel.name}: episode ${index + 1}`, index + channelIndex, index === 1 && channelIndex === 0 ? "in_progress" : "unwatched")));
  return { channels, videos };
}

async function readOrDemo<T>(reader: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!hasDatabase()) return fallback();
  try {
    return await reader();
  } catch (error) {
    console.error("HomeTube database read failed; showing demo fallback.", error);
    return fallback();
  }
}

export async function getHomeData(): Promise<{ videos: FeedVideo[]; generatedAt: string }> {
  return readOrDemo(
    async () => {
      const rows = await listFeedVideoRows();
      const videos = rows.map((row) => {
        const video = mapVideoRow(row);
        return {
          ...video,
          channelVideosPresented: Number(row.channel_videos_presented ?? 0),
          channelVideosWatched: Number(row.channel_videos_watched ?? 0),
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
            source: row.channel_source as Channel["source"]
          })
        };
      });
      const ranked = rankHomeVideos(videos, appConfig.homeRecommendationTarget);
      await replaceActiveRecommendations(ranked);
      const presentations = new Map<string, number>();
      for (const video of ranked) presentations.set(video.channelId, (presentations.get(video.channelId) ?? 0) + 1);
      await Promise.all([...presentations.entries()].map(([channelId, count]) => recordChannelPresentation(channelId, count)));
      return { videos: ranked, generatedAt: new Date().toISOString() };
    },
    () => {
      const demo = demoData();
      const ranked = demo.videos.map((video) => ({ ...video, channelPreference: scoreChannel(demo.channels.find((channel) => channel.id === video.channelId)!) }));
      return { videos: rankHomeVideos(ranked, appConfig.homeRecommendationTarget), generatedAt: new Date().toISOString() };
    }
  );
}

export async function getChannelsData(): Promise<Channel[]> {
  return readOrDemo(listChannels, () => demoData().channels);
}

export async function getDownloadsData(): Promise<Video[]> {
  return readOrDemo(listDownloadVideos, () => []);
}

export async function getChannelData(id: string): Promise<{ channel: Channel | null; videos: Video[] }> {
  return readOrDemo(
    async () => {
      const [channel, videos] = await Promise.all([findChannelById(id), listVideosByChannel(id)]);
      return { channel, videos };
    },
    () => {
      const demo = demoData();
      const channel = demo.channels.find((candidate) => candidate.id === id) ?? null;
      return { channel, videos: channel ? demo.videos.filter((video) => video.channelId === id) : [] };
    }
  );
}

export async function getPodcastData(): Promise<{ channels: Channel[]; unwatched: Video[]; inProgress: Video[]; completed: Video[] }> {
  return readOrDemo(
    async () => {
      const [channels, episodes] = await Promise.all([listPodcastChannels(), listPodcastEpisodes()]);
      return { channels, ...podcastSections(episodes) };
    },
    () => {
      const demo = demoData();
      const episodes = demo.videos.filter((video) => video.isPodcast);
      return { channels: demo.channels.filter((channel) => channel.isPodcast), ...podcastSections(episodes) };
    }
  );
}

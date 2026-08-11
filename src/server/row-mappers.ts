import type { Channel, MediaFile, Video } from "@/domain/types";

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function mapChannelRow(row: Record<string, unknown>): Channel {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    name: String(row.name),
    handle: nullableString(row.handle),
    description: nullableString(row.description),
    thumbnailUrl: nullableString(row.thumbnail_url),
    source: row.source as Channel["source"],
    isSubscribed: bool(row.is_subscribed),
    isRetained: bool(row.is_retained),
    isPruned: bool(row.is_pruned),
    isPodcast: bool(row.is_podcast),
    isPinned: bool(row.is_pinned),
    trialStartedAt: row.trial_started_at ? new Date(String(row.trial_started_at)).toISOString() : null,
    trialEndsAt: row.trial_ends_at ? new Date(String(row.trial_ends_at)).toISOString() : null,
    videosPresented: numberValue(row.videos_presented),
    videosOpened: numberValue(row.videos_opened),
    videosWatched: numberValue(row.videos_watched),
    averagePercentageWatched: numberValue(row.average_percentage_watched),
    recentEngagement: numberValue(row.recent_engagement),
    lastInteractionAt: row.last_interaction_at ? new Date(String(row.last_interaction_at)).toISOString() : null,
    rejectionCount: numberValue(row.rejection_count),
    lastRejectionReason: nullableString(row.last_rejection_reason),
    lastAiJustification: nullableString(row.last_ai_justification)
  };
}

export function mapMediaRow(row: Record<string, unknown>): MediaFile | null {
  if (!row.media_id) return null;
  return {
    id: String(row.media_id),
    videoId: String(row.video_id),
    path: String(row.media_path),
    bytes: numberValue(row.media_bytes),
    height: numberValue(row.media_height),
    mimeType: String(row.media_mime_type ?? "video/mp4"),
    state: row.media_state as MediaFile["state"],
    downloadedAt: row.media_downloaded_at ? new Date(String(row.media_downloaded_at)).toISOString() : null,
    lastAccessedAt: row.media_last_accessed_at ? new Date(String(row.media_last_accessed_at)).toISOString() : null
  };
}

export function mapVideoRow(row: Record<string, unknown>): Video {
  return {
    id: String(row.video_id ?? row.id),
    providerId: String(row.provider_id),
    channelId: String(row.channel_id),
    channelName: String(row.channel_name ?? "Unknown channel"),
    title: String(row.title),
    description: nullableString(row.description),
    thumbnailUrl: nullableString(row.thumbnail_url),
    publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
    durationSeconds: numberValue(row.duration_seconds),
    viewCount: row.view_count == null ? null : numberValue(row.view_count),
    watchState: row.watch_state as Video["watchState"],
    progressSeconds: numberValue(row.progress_seconds),
    watchPercentage: numberValue(row.watch_percentage),
    isTrial: bool(row.is_trial),
    isIgnored: bool(row.is_ignored),
    isPinned: bool(row.is_pinned),
    recommendationScore: numberValue(row.recommendation_score),
    isPodcast: bool(row.is_podcast),
    media: mapMediaRow({ ...row, video_id: row.video_id ?? row.id })
  };
}


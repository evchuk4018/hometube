import { z } from 'zod';

export const channelUrlRequestSchema = z.object({
  url: z.string().trim().min(1).max(500)
});

export const jobStatusSchema = z.enum(['queued', 'running', 'ready', 'failed']);
export const mediaStatusSchema = z.enum(['not_downloaded', 'queued', 'downloading', 'ready', 'failed']);

export const jobSummarySchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['import_channel', 'download_video']),
  status: jobStatusSchema,
  progress: z.number().min(0).max(100),
  stage: z.string(),
  error: z.string().nullable()
});

export const channelSummarySchema = z.object({
  id: z.string().uuid(),
  youtubeChannelId: z.string().nullable(),
  sourceUrl: z.string().url(),
  name: z.string(),
  handle: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  importStatus: z.enum(['queued', 'importing', 'ready', 'failed']),
  importError: z.string().nullable(),
  videoCount: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative()
});

export const videoSummarySchema = z.object({
  id: z.string(),
  channelId: z.string().uuid(),
  channelName: z.string(),
  title: z.string(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  uploadDate: z.string().nullable(),
  viewCount: z.number().int().nonnegative().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  webUrl: z.string().url(),
  availability: z.string(),
  liveStatus: z.string().nullable(),
  mediaStatus: mediaStatusSchema,
  mediaError: z.string().nullable(),
  hasBackgroundAudio: z.boolean(),
  downloadable: z.boolean()
});

export type JobSummary = z.infer<typeof jobSummarySchema>;
export type ChannelSummary = z.infer<typeof channelSummarySchema>;
export type VideoSummary = z.infer<typeof videoSummarySchema>;

export type ChannelPagePayload = {
  channel: ChannelSummary;
  videos: VideoSummary[];
  total: number;
  activeJob: JobSummary | null;
};

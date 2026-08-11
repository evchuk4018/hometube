import { z } from "zod";

export const actionSchema = z.object({
  action: z.enum(["watched", "unwatched", "pin", "unpin", "download", "delete-media"])
});

export const progressSchema = z.object({
  positionSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  manualState: z.enum(["watched", "unwatched"]).optional()
});

export const channelActionSchema = z.object({
  action: z.enum(["retain", "unretain", "prune", "unprune", "podcast", "normal", "pin", "unpin"])
});

export const createChannelSchema = z.object({
  providerId: z.string().trim().min(2).max(120),
  name: z.string().trim().min(1).max(200),
  handle: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().url().max(1000).optional()
});

export type VideoAction = z.infer<typeof actionSchema>["action"];

import { DEFAULT_COMPLETION_THRESHOLD } from "@/domain/watch-state";
import { DEFAULT_MEDIA_TARGET_BYTES, MAX_MEDIA_BYTES } from "@/domain/media-policy";

function numberEnv(name: string, fallback: number, minimum = 0): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
}

export const appConfig = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  accessToken: process.env.APP_ACCESS_TOKEN ?? "",
  mediaRoot: process.env.MEDIA_ROOT ?? "/srv/storage/hometube-media",
  mediaTargetBytes: Math.min(numberEnv("MEDIA_TARGET_BYTES", DEFAULT_MEDIA_TARGET_BYTES, 1), MAX_MEDIA_BYTES),
  completionThreshold: Math.min(numberEnv("COMPLETION_THRESHOLD", DEFAULT_COMPLETION_THRESHOLD, 0.01), 1),
  homeRecommendationTarget: Math.floor(numberEnv("HOME_RECOMMENDATION_TARGET", 40, 1)),
  autoDownloadCount: Math.floor(numberEnv("AUTO_DOWNLOAD_COUNT", 8, 1)),
  trialPoolSize: Math.floor(numberEnv("TRIAL_POOL_SIZE", 10, 1)),
  discoveryChannelCount: Math.floor(numberEnv("DISCOVERY_CHANNEL_COUNT", 10, 1)),
  discoveryCadenceHours: Math.floor(numberEnv("DISCOVERY_CADENCE_HOURS", 168, 1)),
  trialDays: Math.floor(numberEnv("TRIAL_DAYS", 21, 1)),
  catalogSyncHours: Math.floor(numberEnv("CATALOG_SYNC_HOURS", 12, 1)),
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  youtubeCookieFile: process.env.YOUTUBE_COOKIE_FILE ?? "",
  workerIntervalSeconds: Math.floor(numberEnv("WORKER_INTERVAL_SECONDS", 2, 1))
} as const;

export function hasDatabase(): boolean {
  return appConfig.databaseUrl.length > 0;
}

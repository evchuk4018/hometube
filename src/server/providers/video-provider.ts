import type { ProviderVideo } from "@/domain/types";

export type DownloadResult = {
  path: string;
  bytes: number;
  height: number;
  mimeType: string;
};

export interface VideoProvider {
  listChannelVideos(providerChannelId: string): Promise<ProviderVideo[]>;
  downloadVideo(providerVideoId: string, outputPath: string, signal?: AbortSignal): Promise<DownloadResult>;
  downloadThumbnail(thumbnailUrl: string, outputPath: string): Promise<void>;
}

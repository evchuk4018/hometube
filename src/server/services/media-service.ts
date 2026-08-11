import { promises as fs } from "node:fs";
import path from "node:path";
import { appConfig } from "../config";
import { mediaPathForVideo, thumbnailPathForVideo } from "@/domain/media-policy";

function isWithinMediaRoot(filePath: string): boolean {
  const root = path.resolve(appConfig.mediaRoot);
  const candidate = path.resolve(filePath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

export async function removePhysicalMedia(filePath: string): Promise<void> {
  if (!isWithinMediaRoot(filePath)) throw new Error("Refusing to delete media outside MEDIA_ROOT.");
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function ensureMediaRoot(): Promise<void> {
  await fs.mkdir(path.resolve(appConfig.mediaRoot), { recursive: true });
}

export function expectedMediaPath(videoId: string): string {
  return mediaPathForVideo(appConfig.mediaRoot, videoId);
}

export function expectedThumbnailPath(videoId: string): string {
  return thumbnailPathForVideo(appConfig.mediaRoot, videoId);
}

export async function removeLocalVideoAssets(videoId: string, mediaPath: string): Promise<void> {
  await removePhysicalMedia(mediaPath);
  await removePhysicalMedia(expectedThumbnailPath(videoId));
}

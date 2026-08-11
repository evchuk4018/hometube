export const THUMBNAIL_PRELOAD_COUNT = 3;

export function shouldPreloadThumbnail(position: number): boolean {
  return Number.isInteger(position) && position >= 0 && position < THUMBNAIL_PRELOAD_COUNT;
}

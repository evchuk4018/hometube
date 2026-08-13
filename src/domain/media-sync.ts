export const MEDIA_SYNC_TOLERANCE_SECONDS = 0.25;

export function needsMediaSync(masterTime: number, followerTime: number): boolean {
  if (!Number.isFinite(masterTime) || !Number.isFinite(followerTime)) return false;
  return Math.abs(masterTime - followerTime) > MEDIA_SYNC_TOLERANCE_SECONDS;
}

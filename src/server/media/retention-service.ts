import { rm } from 'node:fs/promises';
import { evictVideo, getTotalMediaBytes, listRetentionCandidates, listStorageCapCandidates, type EvictionTarget } from './retention-repository';
import { resolveMediaPath } from './media-path';

export type RetentionMaintenanceResult = {
  deletedCount: number;
  freedBytes: number;
};

export function retentionCutoff(retentionDays: number, now = new Date()): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export function retentionThresholds(capBytes: number, highPct: number, lowPct: number): { highBytes: number; lowBytes: number } {
  return { highBytes: capBytes * highPct, lowBytes: capBytes * lowPct };
}

export function readRetentionConfig(env: Record<string, string | undefined> = process.env) {
  const capBytes = positiveNumber(env.HOMETUBE_MEDIA_CAP_BYTES, 256 * 1024 ** 3);
  const { highBytes, lowBytes } = retentionThresholds(
    capBytes,
    boundedNumber(env.HOMETUBE_MEDIA_CAP_HIGH_PCT, 0.9),
    boundedNumber(env.HOMETUBE_MEDIA_CAP_LOW_PCT, 0.8)
  );
  return {
    retentionDays: positiveNumber(env.HOMETUBE_RETENTION_DAYS, 30),
    highBytes,
    lowBytes
  };
}

export async function runRetentionMaintenance(root?: string): Promise<RetentionMaintenanceResult> {
  const { retentionDays, highBytes, lowBytes } = readRetentionConfig();
  const result: RetentionMaintenanceResult = { deletedCount: 0, freedBytes: 0 };

  const cutoff = retentionCutoff(retentionDays);
  for (const target of await listRetentionCandidates(cutoff)) {
    await evictCandidate(target, root, result);
  }

  let total = await getTotalMediaBytes();
  while (total >= highBytes) {
    const candidates = await listStorageCapCandidates(256);
    if (candidates.length === 0) break;
    let underTarget = false;
    for (const target of candidates) {
      const freed = await evictCandidate(target, root, result);
      total -= freed;
      if (total < lowBytes) {
        underTarget = true;
        break;
      }
    }
    if (underTarget) break;
  }

  return result;
}

async function evictCandidate(
  target: EvictionTarget,
  root: string | undefined,
  result: RetentionMaintenanceResult
): Promise<number> {
  try {
    const deleted = await evictVideo(target.videoId);
    if (!deleted) return 0;
    await removeMediaFiles(deleted, root);
    result.deletedCount += 1;
    result.freedBytes += deleted.sizeBytes + deleted.audioSizeBytes;
    return deleted.sizeBytes + deleted.audioSizeBytes;
  } catch (error) {
    console.error(`Retention could not evict ${target.videoId}:`, error);
    return 0;
  }
}

export async function removeMediaFiles(target: EvictionTarget, root?: string): Promise<void> {
  const paths = [target.relativePath, target.audioRelativePath].filter((value): value is string => value !== null);
  for (const relative of paths) {
    await rm(resolveMediaPath(relative, root), { force: true }).catch(() => undefined);
  }
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
}

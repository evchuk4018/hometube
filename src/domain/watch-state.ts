import type { WatchState } from "./types";

export const DEFAULT_COMPLETION_THRESHOLD = 0.9;

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function percentageFromProgress(positionSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return clampPercentage(positionSeconds / durationSeconds);
}

export function stateFromProgress(
  positionSeconds: number,
  durationSeconds: number,
  completionThreshold = DEFAULT_COMPLETION_THRESHOLD
): WatchState {
  const percentage = percentageFromProgress(positionSeconds, durationSeconds);
  const threshold = Math.min(1, Math.max(0.01, completionThreshold));
  if (percentage <= 0) return "unwatched";
  return percentage >= threshold ? "watched" : "in_progress";
}

export function progressUpdate(input: {
  positionSeconds: number;
  durationSeconds: number;
  completionThreshold?: number;
  manualState?: Extract<WatchState, "watched" | "unwatched">;
}): { state: WatchState; positionSeconds: number; watchPercentage: number } {
  const position = Math.max(0, Number(input.positionSeconds) || 0);
  const duration = Math.max(0, Number(input.durationSeconds) || 0);
  const watchPercentage = percentageFromProgress(position, duration);
  const state = input.manualState ?? stateFromProgress(position, duration, input.completionThreshold);
  return {
    state,
    positionSeconds: duration > 0 ? Math.min(position, duration) : position,
    watchPercentage: input.manualState === "watched" ? 1 : input.manualState === "unwatched" ? 0 : watchPercentage
  };
}

export function isFinished(state: WatchState, watchPercentage: number, threshold = DEFAULT_COMPLETION_THRESHOLD): boolean {
  return state === "watched" || watchPercentage >= threshold;
}

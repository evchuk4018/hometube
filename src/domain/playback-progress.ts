export type PlaybackWatchState = 'unwatched' | 'in_progress' | 'watched';

export const RESUME_END_TOLERANCE_SECONDS = 5;

export function getResumePosition(
  savedPositionSeconds: number,
  currentDurationSeconds: number,
  watchState: PlaybackWatchState,
  endToleranceSeconds = RESUME_END_TOLERANCE_SECONDS
): number {
  if (watchState === 'watched') return 0;
  if (!Number.isFinite(savedPositionSeconds) || savedPositionSeconds <= 0) return 0;
  if (!Number.isFinite(currentDurationSeconds) || currentDurationSeconds <= 0) return 0;
  if (!Number.isFinite(endToleranceSeconds) || endToleranceSeconds < 0) return 0;

  const resumeLimit = Math.max(0, currentDurationSeconds - endToleranceSeconds);
  return savedPositionSeconds < resumeLimit ? Math.min(savedPositionSeconds, currentDurationSeconds) : 0;
}

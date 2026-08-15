export const DEFAULT_MINUTES = 0;
export const STEP_MINUTES = 5;
export const MAX_MINUTES = 120;

export function adjustMinutes(minutes: number, deltaMinutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(0, Math.round(minutes / STEP_MINUTES) * STEP_MINUTES + deltaMinutes));
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

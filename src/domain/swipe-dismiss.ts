export const SWIPE_DISMISS_THRESHOLD = 72;
export const SWIPE_HORIZONTAL_RATIO = 1.25;

export function isHorizontalSwipe(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_HORIZONTAL_RATIO;
}

export function shouldDismissSwipe(deltaX: number, deltaY: number): boolean {
  return deltaX < 0
    && Math.abs(deltaX) >= SWIPE_DISMISS_THRESHOLD
    && isHorizontalSwipe(deltaX, deltaY);
}

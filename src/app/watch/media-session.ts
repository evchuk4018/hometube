export type MediaSessionPlayer = Pick<HTMLMediaElement, "currentTime" | "duration" | "playbackRate">;

export function browserMediaSession(): MediaSession | null {
  if (typeof navigator === "undefined") return null;
  const browserNavigator = navigator as Navigator & { mediaSession?: MediaSession };
  return browserNavigator.mediaSession ?? null;
}

export function configureMediaAction(
  session: MediaSession,
  action: MediaSessionAction,
  handler: ((details: MediaSessionActionDetails) => void) | null
): void {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // A browser may know the Media Session API but not support every action.
  }
}

export function setMediaSessionPlaybackState(session: MediaSession | null, state: MediaSessionPlaybackState): void {
  if (!session) return;
  try {
    session.playbackState = state;
  } catch {
    // Playback state is optional and can be rejected by older implementations.
  }
}

export function updateMediaSessionPosition(player: MediaSessionPlayer): void {
  const session = browserMediaSession();
  if (!session || !Number.isFinite(player.duration) || player.duration <= 0 || !Number.isFinite(player.currentTime)) return;
  try {
    session.setPositionState({
      duration: player.duration,
      playbackRate: player.playbackRate,
      position: Math.min(Math.max(player.currentTime, 0), player.duration)
    });
  } catch {
    // Position state is optional and can be rejected for an unloaded player.
  }
}

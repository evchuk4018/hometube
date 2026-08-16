export type PlaybackWatchState = 'unwatched' | 'in_progress' | 'watched';

export function shouldClearCurrentPlaybackSession(watchState: PlaybackWatchState): boolean {
  return watchState === 'watched';
}

export function shouldResumeCurrentPlaybackSession(referer: string | null, host: string | null): boolean {
  if (!referer || !host) return true;
  try {
    return new URL(referer).host !== host;
  } catch {
    return true;
  }
}

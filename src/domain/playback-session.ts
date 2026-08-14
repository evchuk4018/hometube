export type PlaybackWatchState = 'unwatched' | 'in_progress' | 'watched';

export function shouldClearCurrentPlaybackSession(watchState: PlaybackWatchState): boolean {
  return watchState === 'watched';
}

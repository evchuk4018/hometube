type MediaPlayer = Pick<HTMLMediaElement,
  'currentTime' | 'duration' | 'paused' | 'ended' | 'seeking' | 'readyState' |
  'playbackRate' | 'play' | 'pause' | 'load' | 'addEventListener' | 'removeEventListener'> & {
    getVideoPlaybackQuality?: () => Pick<VideoPlaybackQuality, 'totalVideoFrames'>;
  };

type Visibility = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;

// Audio owns the timeline. Let the video decode between corrections instead of
// continually interrupting it with seeks from the audio's timeupdate events.
export function followAudioPlayback(audio: MediaPlayer, video: MediaPlayer, visibility: Visibility, {
  now = () => performance.now(),
  schedule = (tick: () => void) => {
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  },
  onPlayError = (error: unknown) => console.warn('HomeTube video could not resume', error)
}: { now?: () => number; schedule?: (tick: () => void) => () => void; onPlayError?: (error: unknown) => void } = {}): () => void {
  let disposed = false;
  let alignPosition = true;
  let audioWaiting = false;
  let playPending = false;
  let retryAfter = 0;
  let lastSeekAt = -Infinity;
  let reportedError = false;
  let pendingSince = 0;
  let seekingSince: number | null = null;
  let lastReloadAt = -Infinity;
  let playGeneration = 0;
  let lastProgressAt = now();
  let lastVideoTime = video.currentTime;
  let lastFrameCount = video.getVideoPlaybackQuality?.().totalVideoFrames;
  const removers: Array<() => void> = [];
  const listen = (target: MediaPlayer | Visibility, event: string, handler: () => void) => {
    target.addEventListener(event, handler);
    removers.push(() => target.removeEventListener(event, handler));
  };
  const pause = () => { if (!video.paused) video.pause(); };
  const shouldPlay = () => !visibility.hidden && !audio.paused && !audio.ended && !audioWaiting;

  const sync = () => {
    if (disposed) return;
    if (!shouldPlay()) {
      lastProgressAt = now();
      pause();
      return;
    }
    const frames = video.getVideoPlaybackQuality?.().totalVideoFrames;
    const advanced = frames !== undefined ? frames !== lastFrameCount : video.currentTime !== lastVideoTime;
    if (advanced) lastProgressAt = now();
    lastVideoTime = video.currentTime;
    lastFrameCount = frames;
    // A backgrounded iOS decoder can leave play/seek pending indefinitely. Reset
    // only the muted follower, preserving the audio element and its permission.
    if (video.seeking) seekingSince ??= now();
    else seekingSince = null;
    const stuck = (playPending && now() - pendingSince >= 8_000)
      || (seekingSince !== null && now() - seekingSince >= 8_000)
      || (!video.paused && now() - lastProgressAt >= 8_000);
    if (stuck && now() - lastReloadAt >= 15_000) {
      lastReloadAt = now();
      playGeneration++;
      playPending = false;
      seekingSince = null;
      lastProgressAt = now();
      alignPosition = true;
      video.load();
      return;
    }
    // Wait for both new sources and any existing seek before touching the clock.
    if (audio.readyState < 1 || video.readyState < 1 || audio.seeking || video.seeking || playPending) return;
    const drift = audio.currentTime - video.currentTime;
    if (!Number.isFinite(drift)) return;
    // A running follower gets rate correction, not recurring seeks. Otherwise
    // slow seeks can complete behind the audio and immediately start another.
    if (alignPosition || (video.paused && Math.abs(drift) > 1.5 && now() - lastSeekAt >= 5_000)) {
      alignPosition = false;
      if (Math.abs(drift) > 0.25) {
        const target = Number.isFinite(video.duration)
          ? Math.max(0, Math.min(audio.currentTime, video.duration)) : Math.max(0, audio.currentTime);
        try {
          video.currentTime = target;
          lastSeekAt = now();
          seekingSince = now();
          // seeked/canplay will resume; do not start or replace an in-flight seek.
          return;
        } catch {
          alignPosition = true;
          return;
        }
      }
    }
    const correction = Math.abs(drift) > 0.25 ? (drift > 0 ? 1.05 : 0.95) : 1;
    const rate = Math.max(0.25, Math.min(4, audio.playbackRate * correction));
    if (video.playbackRate !== rate) video.playbackRate = rate;
    if (!video.paused || video.readyState < 2 || now() < retryAfter) return;
    playPending = true;
    pendingSince = now();
    const generation = ++playGeneration;
    void video.play().then(() => {
      if (disposed || generation !== playGeneration) return;
      reportedError = false;
      lastProgressAt = now();
      if (!shouldPlay()) pause();
    }).catch((error: unknown) => {
      if (disposed || generation !== playGeneration) return;
      retryAfter = now() + 3_000;
      if (!reportedError) onPlayError(error);
      reportedError = true;
    }).finally(() => { if (generation === playGeneration) playPending = false; });
  };

  listen(audio, 'play', () => { audioWaiting = false; retryAfter = 0; sync(); });
  listen(audio, 'playing', () => { audioWaiting = false; sync(); });
  listen(audio, 'canplay', () => { audioWaiting = false; sync(); });
  listen(audio, 'waiting', () => { audioWaiting = true; pause(); });
  listen(audio, 'pause', pause);
  listen(audio, 'ended', pause);
  listen(audio, 'seeking', () => { alignPosition = true; pause(); });
  for (const event of ['loadedmetadata', 'seeked', 'timeupdate', 'ratechange']) listen(audio, event, sync);
  for (const event of ['loadedmetadata', 'canplay', 'playing']) listen(video, event, sync);
  listen(video, 'seeked', () => { lastSeekAt = now(); lastProgressAt = now(); sync(); });
  listen(visibility, 'visibilitychange', () => {
    alignPosition = true;
    retryAfter = 0;
    sync();
  });
  // Do not depend on timeupdate frequency after iOS background throttling.
  removers.push(schedule(sync));
  sync();
  return () => {
    disposed = true;
    for (const remove of removers) remove();
    pause();
  };
}

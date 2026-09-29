'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { needsMediaSync } from '@/domain/media-sync';
import { getResumePosition } from '@/domain/playback-progress';
import { appPath } from '@/lib/app-path';
import type { VideoSummary } from '@/protocol/schemas';

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};
type FullscreenMode = 'none' | 'element' | 'native-video' | 'viewport';
type ScreenWakeLock = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void, options?: AddEventListenerOptions) => void;
};
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<ScreenWakeLock> };
};
const LANDSCAPE_PLAYER_QUERY = '(orientation: landscape) and (max-height: 600px)';

function subscribeToLandscapePlayer(onChange: () => void) {
  const query = window.matchMedia(LANDSCAPE_PLAYER_QUERY);
  if (query.addEventListener) {
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

function isLandscapePlayer() {
  return window.matchMedia(LANDSCAPE_PLAYER_QUERY).matches;
}

export type PlayerControl = { pause: () => void };

export function VideoPlayer({ video, playerControlRef, onEnded, onNextTrack, autoplayTick }: {
  video: VideoSummary;
  playerControlRef: RefObject<PlayerControl | null>;
  onEnded?: () => void;
  onNextTrack?: () => void;
  autoplayTick?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('none');
  const [wakeLockUnavailable, setWakeLockUnavailable] = useState(false);
  const landscapePlayer = useSyncExternalStore(subscribeToLandscapePlayer, isLandscapePlayer, () => false);
  const shouldKeepScreenAwake = fullscreenMode !== 'none' || landscapePlayer;

  useEffect(() => {
    const player = videoRef.current;
    const syncFullscreen = () => {
      const fullscreenElement = document.fullscreenElement;
      setFullscreenMode((current) => {
        if (fullscreenElement) return shellRef.current?.contains(fullscreenElement) ? 'element' : 'none';
        return current === 'viewport' || current === 'native-video' ? current : 'none';
      });
    };
    const enterNativeFullscreen = () => setFullscreenMode('native-video');
    const exitNativeFullscreen = () => setFullscreenMode('none');
    document.addEventListener('fullscreenchange', syncFullscreen);
    player?.addEventListener('webkitbeginfullscreen', enterNativeFullscreen);
    player?.addEventListener('webkitendfullscreen', exitNativeFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      player?.removeEventListener('webkitbeginfullscreen', enterNativeFullscreen);
      player?.removeEventListener('webkitendfullscreen', exitNativeFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!shouldKeepScreenAwake) return;

    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let cancelled = false;
    let pending = false;
    let activeLock: ScreenWakeLock | null = null;
    const release = () => {
      if (activeLock) {
        void activeLock.release().catch(() => undefined);
        activeLock = null;
      }
    };
    const acquire = async () => {
      if (cancelled || pending || activeLock || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const lock = await wakeLock.request('screen');
        if (cancelled || document.visibilityState !== 'visible') {
          void lock.release().catch(() => undefined);
        } else {
          activeLock = lock;
          setWakeLockUnavailable(false);
          lock.addEventListener('release', () => {
            if (activeLock === lock) {
              activeLock = null;
              if (!cancelled && document.visibilityState === 'visible') setWakeLockUnavailable(true);
            }
          }, { once: true });
        }
      } catch {
        if (!cancelled) setWakeLockUnavailable(true);
      } finally {
        pending = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
      else release();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void acquire();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    if (fullscreenMode !== 'viewport') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenMode('none');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreenMode]);

  useEffect(() => {
    const player = video.hasBackgroundAudio ? audioRef.current : videoRef.current;
    if (!player) return;
    playerControlRef.current = { pause: () => player.pause() };
    return () => { playerControlRef.current = null; };
  }, [video.hasBackgroundAudio, video.id, playerControlRef]);

  useEffect(() => {
    const player = video.hasBackgroundAudio ? audioRef.current : videoRef.current;
    if (!player || !onEnded) return;
    player.addEventListener('ended', onEnded);
    return () => player.removeEventListener('ended', onEnded);
  }, [video.hasBackgroundAudio, video.id, onEnded]);

  useEffect(() => {
    const player = video.hasBackgroundAudio ? audioRef.current : videoRef.current;
    if (!player || !autoplayTick) return;
    const attempt = () => {
      if (player.paused && !player.ended) void player.play().catch(() => undefined);
    };
    attempt();
    player.addEventListener('canplay', attempt);
    player.addEventListener('loadedmetadata', attempt);
    return () => {
      player.removeEventListener('canplay', attempt);
      player.removeEventListener('loadedmetadata', attempt);
    };
  }, [video.hasBackgroundAudio, video.id, autoplayTick]);

  useEffect(() => {
    if (!video.hasBackgroundAudio) return;
    const visualPlayer = videoRef.current;
    const audioPlayer = audioRef.current;
    if (!visualPlayer || !audioPlayer) return;

    const syncPosition = (force = false) => {
      if (force || needsMediaSync(audioPlayer.currentTime, visualPlayer.currentTime)) {
        try { visualPlayer.currentTime = audioPlayer.currentTime; } catch { /* metadata may still be loading */ }
      }
    };
    const playVisual = () => {
      if (document.hidden || audioPlayer.paused || audioPlayer.ended) return;
      syncPosition();
      if (visualPlayer.paused) void visualPlayer.play().catch(() => undefined);
    };
    const pauseVisual = () => {
      if (!visualPlayer.paused) visualPlayer.pause();
    };
    const syncPlayback = () => {
      if (document.hidden) {
        pauseVisual();
        return;
      }
      syncPosition();
      if (visualPlayer.playbackRate !== audioPlayer.playbackRate) {
        visualPlayer.playbackRate = audioPlayer.playbackRate;
      }
      if (audioPlayer.paused || audioPlayer.ended) pauseVisual();
      else playVisual();
    };
    const seekVisual = () => syncPosition(true);
    const updateRate = () => {
      visualPlayer.playbackRate = audioPlayer.playbackRate;
    };

    audioPlayer.addEventListener('play', playVisual);
    audioPlayer.addEventListener('playing', playVisual);
    audioPlayer.addEventListener('pause', pauseVisual);
    audioPlayer.addEventListener('waiting', pauseVisual);
    audioPlayer.addEventListener('seeking', seekVisual);
    audioPlayer.addEventListener('seeked', syncPlayback);
    audioPlayer.addEventListener('ratechange', updateRate);
    audioPlayer.addEventListener('timeupdate', syncPlayback);
    audioPlayer.addEventListener('ended', pauseVisual);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      audioPlayer.removeEventListener('play', playVisual);
      audioPlayer.removeEventListener('playing', playVisual);
      audioPlayer.removeEventListener('pause', pauseVisual);
      audioPlayer.removeEventListener('waiting', pauseVisual);
      audioPlayer.removeEventListener('seeking', seekVisual);
      audioPlayer.removeEventListener('seeked', syncPlayback);
      audioPlayer.removeEventListener('ratechange', updateRate);
      audioPlayer.removeEventListener('timeupdate', syncPlayback);
      audioPlayer.removeEventListener('ended', pauseVisual);
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [video.hasBackgroundAudio, video.id]);

  useEffect(() => {
    const player = video.hasBackgroundAudio ? audioRef.current : videoRef.current;
    if (!player || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: video.title,
      artist: video.channelName,
      artwork: video.thumbnailUrl ? [{ src: video.thumbnailUrl, sizes: '480x360', type: 'image/jpeg' }] : []
    });

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => { void player.play(); }],
      ['pause', () => player.pause()],
      ['seekto', (details) => { if (details.seekTime !== undefined) player.currentTime = details.seekTime; }]
    ];
    if (onNextTrack) {
      const skipToNext = () => onNextTrack();
      handlers.push(['seekbackward', skipToNext], ['seekforward', skipToNext], ['nexttrack', skipToNext]);
    } else {
      handlers.push(
        ['seekbackward', (details) => { player.currentTime = Math.max(0, player.currentTime - (details.seekOffset ?? 10)); }],
        ['seekforward', (details) => { player.currentTime = Math.min(player.duration || Infinity, player.currentTime + (details.seekOffset ?? 10)); }]
      );
    }
    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }

    const updateState = () => {
      navigator.mediaSession.playbackState = player.paused ? 'paused' : 'playing';
      if (Number.isFinite(player.duration) && player.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({ duration: player.duration, playbackRate: player.playbackRate, position: Math.min(player.currentTime, player.duration) });
        } catch { /* position state is best-effort */ }
      }
    };
    player.addEventListener('play', updateState);
    player.addEventListener('pause', updateState);
    player.addEventListener('durationchange', updateState);
    player.addEventListener('timeupdate', updateState);
    return () => {
      player.removeEventListener('play', updateState);
      player.removeEventListener('pause', updateState);
      player.removeEventListener('durationchange', updateState);
      player.removeEventListener('timeupdate', updateState);
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [video, onNextTrack]);

  useEffect(() => {
    const player = video.hasBackgroundAudio ? audioRef.current : videoRef.current;
    if (!player) return;
    let lastSavedAt = 0;
    let restored = false;
    const save = (keepalive = false) => {
      if (!Number.isFinite(player.duration) || player.duration <= 0) return;
      lastSavedAt = Date.now();
      void fetch(appPath(`/api/videos/${video.id}/progress`), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ positionSeconds: player.currentTime, durationSeconds: player.duration }), keepalive
      }).catch(() => undefined);
    };
    const restore = () => {
      if (restored || player.readyState < 1 || !Number.isFinite(player.duration) || player.duration <= 0) return;
      const resumePosition = getResumePosition(video.playbackPositionSeconds, player.duration, video.watchState);
      restored = true;
      if (resumePosition > 0) {
        try { player.currentTime = resumePosition; } catch { /* metadata may still be loading */ }
      }
    };
    const periodicallySave = () => {
      if (Date.now() - lastSavedAt >= 10_000) save();
    };
    const saveEvent = () => save();
    const saveOnExit = () => save(true);
    player.addEventListener('loadedmetadata', restore);
    player.addEventListener('durationchange', restore);
    restore();
    player.addEventListener('timeupdate', periodicallySave);
    player.addEventListener('pause', saveEvent);
    player.addEventListener('seeked', saveEvent);
    player.addEventListener('ended', saveEvent);
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') save(true);
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    window.addEventListener('pagehide', saveOnExit);
    return () => {
      player.removeEventListener('loadedmetadata', restore);
      player.removeEventListener('durationchange', restore);
      player.removeEventListener('timeupdate', periodicallySave);
      player.removeEventListener('pause', saveEvent);
      player.removeEventListener('seeked', saveEvent);
      player.removeEventListener('ended', saveEvent);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      window.removeEventListener('pagehide', saveOnExit);
      save(true);
    };
  }, [video.hasBackgroundAudio, video.id, video.playbackPositionSeconds, video.watchState]);

  function enterFullscreen() {
    const shell = shellRef.current;
    const player = videoRef.current as WebkitVideo | null;
    if (fullscreenMode === 'viewport') {
      setFullscreenMode('none');
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (fullscreenMode === 'native-video') {
      player?.webkitExitFullscreen?.();
      return;
    }

    setWakeLockUnavailable(false);

    const fallback = () => {
      // iOS only supports native video fullscreen. Keep the separate audio controls
      // available in viewport mode when a video has a background audio track.
      if (!video.hasBackgroundAudio && player?.webkitEnterFullscreen) {
        try {
          player.webkitEnterFullscreen();
          setFullscreenMode('native-video');
          return;
        } catch { /* use the viewport fallback */ }
      }
      setFullscreenMode('viewport');
    };
    if (shell?.requestFullscreen && document.fullscreenEnabled) void shell.requestFullscreen().catch(fallback);
    else fallback();
  }

  return (
    <div className={`player-shell${video.hasBackgroundAudio ? ' background-audio-player' : ''}${fullscreenMode === 'viewport' ? ' viewport-fullscreen' : ''}`} ref={shellRef}>
      <video
        ref={videoRef}
        src={appPath(`/api/videos/${video.id}/stream`)}
        poster={video.thumbnailUrl ?? undefined}
        controls={!video.hasBackgroundAudio}
        muted={video.hasBackgroundAudio}
        playsInline preload="metadata"
      />
      {video.hasBackgroundAudio && (
        <audio
          ref={audioRef}
          className="background-audio-controls"
          src={appPath(`/api/videos/${video.id}/audio`)}
          aria-label={`Playback controls for ${video.title}`}
          controls preload="metadata"
        />
      )}
      {shouldKeepScreenAwake && fullscreenMode !== 'native-video' && (wakeLockUnavailable || !(navigator as WakeLockNavigator).wakeLock) && <p className="wake-lock-warning" role="status">Screen may turn off on this device</p>}
      <button className="fullscreen-button" type="button" onClick={enterFullscreen} aria-label={fullscreenMode === 'none' ? 'Enter fullscreen' : 'Exit fullscreen'}>
        {fullscreenMode === 'none'
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
      </button>
    </div>
  );
}

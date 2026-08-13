'use client';

import { useEffect, useRef } from 'react';
import { appPath } from '@/lib/app-path';
import type { VideoSummary } from '@/protocol/schemas';

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function VideoPlayer({ video }: { video: VideoSummary }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: video.title,
      artist: video.channelName,
      artwork: video.thumbnailUrl ? [{ src: video.thumbnailUrl, sizes: '480x360', type: 'image/jpeg' }] : []
    });

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => { void player.play(); }],
      ['pause', () => player.pause()],
      ['seekbackward', (details) => { player.currentTime = Math.max(0, player.currentTime - (details.seekOffset ?? 10)); }],
      ['seekforward', (details) => { player.currentTime = Math.min(player.duration || Infinity, player.currentTime + (details.seekOffset ?? 10)); }],
      ['seekto', (details) => { if (details.seekTime !== undefined) player.currentTime = details.seekTime; }]
    ];
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
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [video]);

  function enterFullscreen() {
    const shell = shellRef.current;
    const player = videoRef.current as WebkitVideo | null;
    if (shell?.requestFullscreen) {
      void shell.requestFullscreen().catch(() => player?.webkitEnterFullscreen?.());
    } else {
      player?.webkitEnterFullscreen?.();
    }
  }

  return (
    <div className="player-shell" ref={shellRef}>
      <video
        ref={videoRef}
        src={appPath(`/api/videos/${video.id}/stream`)}
        poster={video.thumbnailUrl ?? undefined}
        controls playsInline preload="metadata"
      />
      <button className="fullscreen-button" type="button" onClick={enterFullscreen} aria-label="Enter fullscreen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}


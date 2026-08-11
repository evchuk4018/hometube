"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Video } from "@/domain/types";
import { appPath } from "../../app-path";
import { StatusPill } from "../../components/status-pill";

type DownloadStatus = { status: string; progressPercent: number | null; queuePosition: number | null } | null;
type NextVideoResponse = { video?: Video | null; error?: string };
type NextVideoResult = { video: Video | null; error?: string };

const SLEEP_OPTIONS = [{ label: "Off", seconds: null }, { label: "15 minutes", seconds: 900 }, { label: "30 minutes", seconds: 1800 }, { label: "60 minutes", seconds: 3600 }, { label: "End of video", seconds: -1 }] as const;

function browserMediaSession(): MediaSession | null {
  if (typeof navigator === "undefined") return null;
  const browserNavigator = navigator as Navigator & { mediaSession?: MediaSession };
  return browserNavigator.mediaSession ?? null;
}

function configureMediaAction(session: MediaSession, action: MediaSessionAction, handler: ((details: MediaSessionActionDetails) => void) | null): void {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // A browser may know the Media Session API but not support every action.
  }
}

function updateMediaSessionPosition(player: HTMLVideoElement): void {
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

export function WatchClient({ initialVideo }: { initialVideo: Video }) {
  const [video, setVideo] = useState(initialVideo);
  const [download, setDownload] = useState<DownloadStatus>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sleepSeconds, setSleepSeconds] = useState<number | null>(null);
  const [sleepLabel, setSleepLabel] = useState("Off");
  const [message, setMessage] = useState("");
  const [playbackMessage, setPlaybackMessage] = useState("");
  const playerRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef(initialVideo);
  const lastProgress = useRef({ videoId: initialVideo.id, position: 0 });
  const refreshInFlight = useRef(false);
  const nextRequestInFlight = useRef(false);
  const autoplayNext = useRef(false);
  const isReady = video.media?.state === "ready";
  const thumbnailUrl = video.thumbnailUrl ? appPath(`/api/videos/${video.id}/thumbnail`) : undefined;
  const downloadLabel = useMemo(() => {
    if (download?.status === "queued") return download.queuePosition ? `Queued · position ${download.queuePosition}` : "Queued";
    if (download?.status === "downloading") return download.progressPercent == null ? "Downloading" : `Downloading · ${Math.round(download.progressPercent)}%`;
    if (download?.status === "failed") return "Download failed";
    if (download?.status === "unavailable") return "Media unavailable";
    return "Preparing local playback";
  }, [download]);

  useEffect(() => {
    activeVideoRef.current = video;
  }, [video]);

  useEffect(() => {
    lastProgress.current = { videoId: video.id, position: 0 };
    setDownload(null);
    setSettingsOpen(false);
  }, [video.id]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    const videoId = activeVideoRef.current.id;
    refreshInFlight.current = true;
    try {
      const response = await fetch(appPath(`/api/videos/${videoId}`), { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { video?: Video; download?: DownloadStatus };
      if (payload.video) setVideo((current) => current.id === videoId ? payload.video! : current);
      if (payload.download !== undefined && activeVideoRef.current.id === videoId) setDownload(payload.download);
    } catch {
      // Keep the current download state when a background refresh is unavailable.
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  const requestDownload = useCallback(async () => {
    const videoId = activeVideoRef.current.id;
    try {
      const response = await fetch(appPath(`/api/videos/${videoId}/actions`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "download" }) });
      const payload = await response.json() as { video?: Video; error?: string };
      if (!response.ok || !payload.video) throw new Error(payload.error ?? "Could not queue this video.");
      setVideo((current) => current.id === videoId ? payload.video! : current);
      setMessage("Added to the front of the download queue.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not queue this video.");
    }
  }, [refresh]);

  useEffect(() => {
    if (isReady || video.media?.state === "queued" || video.media?.state === "downloading") return;
    void requestDownload();
  // The initial watch-page visit is the explicit acquire-and-watch action.
  }, [isReady, requestDownload, video.media?.state]);

  useEffect(() => {
    if (isReady) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(() => void refresh(), 1500);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenVisible);
    void refresh();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshWhenVisible);
    };
  }, [isReady, refresh]);

  useEffect(() => {
    if (sleepSeconds == null || sleepSeconds < 0) return;
    const timeout = window.setTimeout(() => {
      playerRef.current?.pause();
      setSleepSeconds(null);
      setSleepLabel("Off");
    }, sleepSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [sleepSeconds]);

  const saveProgress = useCallback(async (videoId: string, positionSeconds: number, durationSeconds: number, force = false, keepalive = false) => {
    if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    const previous = lastProgress.current;
    if (!force && previous.videoId === videoId && Math.abs(positionSeconds - previous.position) < 8 && positionSeconds < durationSeconds - 2) return;
    lastProgress.current = { videoId, position: positionSeconds };
    try {
      const response = await fetch(appPath(`/api/videos/${videoId}/progress`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positionSeconds, durationSeconds }),
        keepalive
      });
      if (!response.ok) return;
      const payload = await response.json() as { video?: Video };
      if (payload.video) setVideo((current) => current.id === videoId ? payload.video! : current);
    } catch {
      // Progress will be retried by the next timeupdate or visibility change.
    }
  }, []);

  const persistCurrentProgress = useCallback(async (force = false): Promise<void> => {
    const player = playerRef.current;
    const current = activeVideoRef.current;
    if (!player) return;
    const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : current.durationSeconds;
    await saveProgress(current.id, player.currentTime, duration, force, force);
  }, [saveProgress]);

  useEffect(() => {
    const persistOnExit = () => persistCurrentProgress(true);
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persistCurrentProgress(true);
    };
    window.addEventListener("pagehide", persistOnExit);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persistOnExit);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [persistCurrentProgress]);

  const requestNextVideo = useCallback(async (currentVideoId: string): Promise<NextVideoResult> => {
    if (nextRequestInFlight.current) return { video: null, error: "A next-video request is already in progress." };
    nextRequestInFlight.current = true;
    try {
      const query = new URLSearchParams({ excludeVideoId: currentVideoId });
      const response = await fetch(appPath(`/api/playback/next?${query.toString()}`), { cache: "no-store" });
      const payload = await response.json() as NextVideoResponse;
      if (!response.ok) throw new Error(payload.error ?? "Could not load the next video.");
      return { video: payload.video ?? null };
    } catch (error) {
      return { video: null, error: error instanceof Error ? error.message : "Could not load the next video." };
    } finally {
      nextRequestInFlight.current = false;
    }
  }, []);

  const advanceToNext = useCallback(async () => {
    const current = activeVideoRef.current;
    const player = playerRef.current;
    if (!player || nextRequestInFlight.current) return;
    player.pause();
    await persistCurrentProgress(true);
    const result = await requestNextVideo(current.id);
    if (result.error) {
      setPlaybackMessage(result.error);
      return;
    }
    if (!result.video) {
      setPlaybackMessage("No more downloaded unwatched videos.");
      return;
    }
    autoplayNext.current = true;
    setPlaybackMessage("");
    setVideo(result.video);
  }, [persistCurrentProgress, requestNextVideo]);

  useEffect(() => {
    const session = browserMediaSession();
    if (!session || !isReady) return;

    configureMediaAction(session, "play", () => {
      void playerRef.current?.play();
    });
    configureMediaAction(session, "pause", () => {
      playerRef.current?.pause();
    });
    configureMediaAction(session, "nexttrack", () => {
      void advanceToNext();
    });
    // Leave the lock-screen controls in track-navigation mode instead of
    // advertising 15-second seek actions.
    configureMediaAction(session, "seekbackward", null);
    configureMediaAction(session, "seekforward", null);

    return () => {
      configureMediaAction(session, "play", null);
      configureMediaAction(session, "pause", null);
      configureMediaAction(session, "nexttrack", null);
      configureMediaAction(session, "seekbackward", null);
      configureMediaAction(session, "seekforward", null);
    };
  }, [advanceToNext, isReady]);

  useEffect(() => {
    const session = browserMediaSession();
    if (!session) return;
    if (!isReady) {
      session.metadata = null;
      session.playbackState = "none";
      return;
    }

    session.metadata = new MediaMetadata({
      title: video.title,
      artist: video.channelName,
      album: "HomeTube",
      artwork: thumbnailUrl ? [{ src: thumbnailUrl }] : []
    });
    session.playbackState = "paused";

    return () => {
      session.metadata = null;
      session.playbackState = "none";
    };
  }, [isReady, thumbnailUrl, video.channelName, video.id, video.title]);

  function chooseSleep(seconds: number | null, label: string) {
    setSleepSeconds(seconds);
    setSleepLabel(label);
    setSettingsOpen(false);
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const player = event.currentTarget;
    if (video.progressSeconds > 0) {
      const maximum = Number.isFinite(player.duration) && player.duration > 0 ? Math.max(0, player.duration - 0.25) : video.progressSeconds;
      player.currentTime = Math.min(video.progressSeconds, maximum);
    }
    updateMediaSessionPosition(player);
    if (autoplayNext.current) {
      autoplayNext.current = false;
      void player.play().catch(() => setPlaybackMessage("Tap play to continue with the next video."));
    }
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const player = event.currentTarget;
    updateMediaSessionPosition(player);
    const current = activeVideoRef.current;
    void saveProgress(current.id, player.currentTime, player.duration || current.durationSeconds);
  }

  function handlePlay(event: SyntheticEvent<HTMLVideoElement>) {
    const session = browserMediaSession();
    if (session) session.playbackState = "playing";
    updateMediaSessionPosition(event.currentTarget);
  }

  function handlePause(event: SyntheticEvent<HTMLVideoElement>) {
    const session = browserMediaSession();
    if (session) session.playbackState = "paused";
    updateMediaSessionPosition(event.currentTarget);
  }

  return (
    <div className="watch-page">
      <Link href={appPath("/")} className="watch-back">‹ Back to Home</Link>
      <div className="watch-player-shell">
        {isReady ? <video key={video.id} ref={playerRef} className="watch-player" controls playsInline preload="metadata" poster={thumbnailUrl} src={appPath(`/api/videos/${video.id}/media`)} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onPlay={handlePlay} onPause={handlePause} onEnded={() => { void advanceToNext(); }} onError={() => { autoplayNext.current = false; setPlaybackMessage("This local video could not be played."); }} /> : <div className="watch-loading" style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.8)), url(${thumbnailUrl})` } : undefined}><span className="watch-loading-icon">▶</span><strong>{downloadLabel}</strong><p>{download?.status === "downloading" ? "Your video will begin as soon as local media is ready." : "This video is being acquired locally for private playback."}</p>{download?.progressPercent != null ? <div className="download-progress" role="progressbar" aria-valuenow={download.progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${download.progressPercent}%` }} /></div> : <div className="download-progress indeterminate"><span /></div>}</div>}
        {isReady ? <div className="player-settings-wrap"><button type="button" className="player-settings-button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>⚙ Settings</button>{settingsOpen ? <div className="player-settings" role="dialog" aria-label="Player settings"><strong>Sleep timer</strong>{SLEEP_OPTIONS.map((option) => <button key={option.label} type="button" className={sleepLabel === option.label ? "selected" : ""} onClick={() => chooseSleep(option.seconds, option.label)}>{option.label}{sleepLabel === option.label ? " ✓" : ""}</button>)}<small>Quality follows HomeTube’s local 720p-or-lower media policy. Start playback before locking your phone or switching apps; background playback follows your browser’s rules.</small></div> : null}</div> : null}
      </div>
      {playbackMessage ? <div className="watch-download-status" role="status" aria-live="polite"><StatusPill tone="blue">Playback</StatusPill><span>{playbackMessage}</span></div> : null}
      <section className="watch-details">
        <p className="kicker">{video.channelName}</p>
        <h1>{video.title}</h1>
        <div className="watch-meta"><span>{video.viewCount ? `${video.viewCount.toLocaleString()} views` : "Views unknown"}</span><span>·</span><span>{video.watchState === "in_progress" ? `${Math.round(video.watchPercentage * 100)}% watched` : video.watchState === "watched" ? "Watched" : "Not watched"}</span>{sleepLabel !== "Off" ? <><span>·</span><span>Sleep: {sleepLabel}</span></> : null}</div>
        {!isReady ? <div className="watch-download-status"><StatusPill tone="blue">{downloadLabel}</StatusPill>{message ? <span>{message}</span> : null}</div> : null}
        {video.description ? <p className="watch-description">{video.description}</p> : null}
      </section>
    </div>
  );
}

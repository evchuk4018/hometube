"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import type { Video } from "@/domain/types";
import { appPath } from "../../app-path";
import { StatusPill } from "../../components/status-pill";
import {
  browserMediaSession,
  configureMediaAction,
  setMediaSessionPlaybackState,
  updateMediaSessionPosition
} from "../media-session";

type DownloadStatus = { status: string; progressPercent: number | null; queuePosition: number | null } | null;
type NextVideoResponse = { video?: Video | null; error?: string };
type NextVideoResult = { video: Video | null; error?: string };

const SLEEP_OPTIONS = [{ label: "Off", seconds: null }, { label: "15 minutes", seconds: 900 }, { label: "30 minutes", seconds: 1800 }, { label: "60 minutes", seconds: 3600 }, { label: "End of video", seconds: -1 }] as const;

export function WatchClient({ initialVideo }: { initialVideo: Video }) {
  const [video, setVideo] = useState(initialVideo);
  const [download, setDownload] = useState<DownloadStatus>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sleepSeconds, setSleepSeconds] = useState<number | null>(null);
  const [sleepLabel, setSleepLabel] = useState("Off");
  const [message, setMessage] = useState("");
  const [playbackMessage, setPlaybackMessage] = useState("");
  const playerRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeVideoRef = useRef(initialVideo);
  const lastProgress = useRef({ videoId: initialVideo.id, position: 0 });
  const refreshInFlight = useRef(false);
  const nextRequestInFlight = useRef(false);
  const advancingVideoId = useRef<string | null>(null);
  const autoplayNext = useRef(false);
  const shouldPlayAudio = useRef(false);
  const audioInitialPosition = useRef(initialVideo.progressSeconds);
  const isReady = video.media?.state === "ready";
  const thumbnailUrl = video.thumbnailUrl ? appPath(`/api/videos/${video.id}/thumbnail`) : undefined;
  const downloadLabel = useMemo(() => {
    if (download?.status === "queued") return download.queuePosition ? `Queued · position ${download.queuePosition}` : "Queued";
    if (download?.status === "downloading") return download.progressPercent == null ? "Downloading" : `Downloading · ${Math.round(download.progressPercent)}%`;
    if (download?.status === "failed") return "Download failed";
    if (download?.status === "unavailable") return "Media unavailable";
    return "Preparing local playback";
  }, [download]);

  const syncVideoToAudio = useCallback(() => {
    const audio = audioRef.current;
    const player = playerRef.current;
    if (!audio || !player || !Number.isFinite(audio.currentTime)) return;
    if (Math.abs(player.currentTime - audio.currentTime) > 0.35) {
      try {
        player.currentTime = audio.currentTime;
      } catch {
        // The visible video may not have loaded metadata yet.
      }
    }
    updateMediaSessionPosition(audio);
  }, []);

  const pausePlayback = useCallback(() => {
    shouldPlayAudio.current = false;
    audioRef.current?.pause();
    const player = playerRef.current;
    if (player && !player.paused) player.pause();
    setMediaSessionPlaybackState(browserMediaSession(), "paused");
  }, []);

  const startPlayback = useCallback(async (positionSeconds?: number): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return false;

    if (Number.isFinite(positionSeconds)) {
      audioInitialPosition.current = positionSeconds ?? 0;
      try {
        audio.currentTime = Math.max(0, positionSeconds ?? 0);
      } catch {
        // The audio metadata may not be available yet; playback will begin at its current position.
      }
    }

    shouldPlayAudio.current = true;
    audio.muted = false;
    const player = playerRef.current;
    if (player) player.muted = true;

    try {
      await audio.play();
    } catch {
      shouldPlayAudio.current = false;
      setMediaSessionPlaybackState(browserMediaSession(), "paused");
      setPlaybackMessage("Tap play to continue playback.");
      return false;
    }

    syncVideoToAudio();
    if (player && document.visibilityState === "visible" && player.paused) {
      void player.play().catch(() => undefined);
    }
    setMediaSessionPlaybackState(browserMediaSession(), "playing");
    return true;
  }, [syncVideoToAudio]);

  const seekTo = useCallback((positionSeconds: number) => {
    const audio = audioRef.current;
    const player = playerRef.current;
    const duration = audio && Number.isFinite(audio.duration) ? audio.duration : player?.duration;
    const position = Number.isFinite(duration) && duration && duration > 0
      ? Math.min(Math.max(positionSeconds, 0), duration)
      : Math.max(positionSeconds, 0);
    try {
      if (audio) audio.currentTime = position;
      if (player) player.currentTime = position;
    } catch {
      // Seeking can race media metadata loading on mobile browsers.
    }
    if (audio) updateMediaSessionPosition(audio);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) seekTo(audio.currentTime + seconds);
  }, [seekTo]);

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
      pausePlayback();
      setSleepSeconds(null);
      setSleepLabel("Off");
    }, sleepSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [pausePlayback, sleepSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isReady) {
      shouldPlayAudio.current = false;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const source = appPath(`/api/videos/${video.id}/media`);
    const absoluteSource = new URL(source, window.location.href).href;
    if (audio.src === absoluteSource) return;

    audioInitialPosition.current = video.progressSeconds;
    shouldPlayAudio.current = false;
    audio.pause();
    audio.src = source;
    audio.load();
  }, [isReady, video.id]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.muted = true;
    const onSeeking = () => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(player.currentTime)) return;
      try {
        audio.currentTime = player.currentTime;
      } catch {
        return;
      }
      updateMediaSessionPosition(audio);
    };
    const forceMuted = () => {
      if (!player.muted) player.muted = true;
    };
    player.addEventListener("seeking", onSeeking);
    player.addEventListener("volumechange", forceMuted);
    return () => {
      player.removeEventListener("seeking", onSeeking);
      player.removeEventListener("volumechange", forceMuted);
    };
  }, [isReady, video.id]);

  useEffect(() => {
    const keepBackgroundAudioActive = () => {
      const audio = audioRef.current;
      const player = playerRef.current;
      if (player) player.muted = true;
      if (!audio || audio.paused) return;
      audio.muted = false;
      syncVideoToAudio();
      if (document.visibilityState === "visible" && player?.paused) {
        void player.play().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", keepBackgroundAudioActive);
    window.addEventListener("pageshow", keepBackgroundAudioActive);
    return () => {
      document.removeEventListener("visibilitychange", keepBackgroundAudioActive);
      window.removeEventListener("pageshow", keepBackgroundAudioActive);
    };
  }, [syncVideoToAudio]);

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
    const audio = audioRef.current;
    const player = playerRef.current;
    const current = activeVideoRef.current;
    const position = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : player?.currentTime;
    const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : player?.duration ?? current.durationSeconds;
    if (position == null) return;
    await saveProgress(current.id, position, duration, force, force);
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
    const audio = audioRef.current;
    const player = playerRef.current;
    if ((!audio && !player) || nextRequestInFlight.current || advancingVideoId.current === current.id) return;
    if (player?.ended && !audio?.ended) return;
    advancingVideoId.current = current.id;
    const continuePlayback = shouldPlayAudio.current || Boolean(audio && !audio.paused);
    pausePlayback();
    await persistCurrentProgress(true);
    const result = await requestNextVideo(current.id);
    if (result.error) {
      advancingVideoId.current = null;
      setPlaybackMessage(result.error);
      return;
    }
    if (!result.video) {
      advancingVideoId.current = null;
      autoplayNext.current = false;
      setPlaybackMessage("No more downloaded unwatched videos.");
      return;
    }
    autoplayNext.current = continuePlayback;
    setPlaybackMessage("");
    setVideo(result.video);
  }, [pausePlayback, persistCurrentProgress, requestNextVideo]);

  useEffect(() => {
    const session = browserMediaSession();
    if (!session || !isReady) return;

    configureMediaAction(session, "play", () => {
      void startPlayback();
    });
    configureMediaAction(session, "pause", () => {
      pausePlayback();
    });
    configureMediaAction(session, "previoustrack", () => {
      seekTo(0);
    });
    configureMediaAction(session, "nexttrack", () => {
      void advanceToNext();
    });
    configureMediaAction(session, "seekbackward", () => {
      seekBy(-10);
    });
    configureMediaAction(session, "seekforward", () => {
      seekBy(10);
    });

    return () => {
      configureMediaAction(session, "play", null);
      configureMediaAction(session, "pause", null);
      configureMediaAction(session, "previoustrack", null);
      configureMediaAction(session, "nexttrack", null);
      configureMediaAction(session, "seekbackward", null);
      configureMediaAction(session, "seekforward", null);
    };
  }, [advanceToNext, isReady, pausePlayback, seekBy, seekTo, startPlayback]);

  useEffect(() => {
    const session = browserMediaSession();
    if (!session) return;
    if (!isReady) {
      session.metadata = null;
      setMediaSessionPlaybackState(session, "none");
      return;
    }

    if (typeof MediaMetadata !== "undefined") {
      session.metadata = new MediaMetadata({
        title: video.title,
        artist: video.channelName,
        album: "HomeTube",
        artwork: thumbnailUrl ? [{ src: thumbnailUrl }] : []
      });
    }
    setMediaSessionPlaybackState(session, "paused");

    return () => {
      session.metadata = null;
      setMediaSessionPlaybackState(session, "none");
    };
  }, [isReady, thumbnailUrl, video.channelName, video.id, video.title]);

  function chooseSleep(seconds: number | null, label: string) {
    setSleepSeconds(seconds);
    setSleepLabel(label);
    setSettingsOpen(false);
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const player = event.currentTarget;
    const audio = audioRef.current;
    const position = audio && !audio.paused && Number.isFinite(audio.currentTime) ? audio.currentTime : video.progressSeconds;
    if (position > 0) {
      const maximum = Number.isFinite(player.duration) && player.duration > 0 ? Math.max(0, player.duration - 0.25) : position;
      player.currentTime = Math.min(position, maximum);
    }
    player.muted = true;
    updateMediaSessionPosition(audio ?? player);
    if (autoplayNext.current && audio && audio.readyState >= 1) {
      autoplayNext.current = false;
      void startPlayback();
    }
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const player = event.currentTarget;
    if (!audioRef.current || audioRef.current.paused) updateMediaSessionPosition(player);
  }

  function handlePlay(event: SyntheticEvent<HTMLVideoElement>) {
    event.currentTarget.muted = true;
    void startPlayback(event.currentTarget.currentTime);
  }

  function handlePause(event: SyntheticEvent<HTMLVideoElement>) {
    if (document.visibilityState === "hidden") return;
    if (event.currentTarget.ended) return;
    audioRef.current?.pause();
    setMediaSessionPlaybackState(browserMediaSession(), "paused");
    updateMediaSessionPosition(audioRef.current ?? event.currentTarget);
  }

  function handleAudioLoadedMetadata(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    if (audioInitialPosition.current > 0 && Math.abs(audio.currentTime - audioInitialPosition.current) > 0.25) {
      const maximum = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.max(0, audio.duration - 0.25) : audioInitialPosition.current;
      audio.currentTime = Math.min(audioInitialPosition.current, maximum);
    }
    updateMediaSessionPosition(audio);
    if (autoplayNext.current) {
      autoplayNext.current = false;
      void startPlayback();
    }
  }

  function handleAudioTimeUpdate(event: SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    syncVideoToAudio();
    const current = activeVideoRef.current;
    void saveProgress(current.id, audio.currentTime, audio.duration || current.durationSeconds);
  }

  function handleAudioPlay(event: SyntheticEvent<HTMLAudioElement>) {
    setMediaSessionPlaybackState(browserMediaSession(), "playing");
    updateMediaSessionPosition(event.currentTarget);
    syncVideoToAudio();
    const player = playerRef.current;
    if (player && document.visibilityState === "visible" && player.paused) {
      player.muted = true;
      void player.play().catch(() => undefined);
    }
  }

  function handleAudioPause(event: SyntheticEvent<HTMLAudioElement>) {
    setMediaSessionPlaybackState(browserMediaSession(), "paused");
    updateMediaSessionPosition(event.currentTarget);
    const player = playerRef.current;
    if (player && document.visibilityState === "visible" && !player.paused) player.pause();
  }

  function handleAudioEnded() {
    void advanceToNext();
  }

  return (
    <div className="watch-page">
      <Link href={appPath("/")} className="watch-back">‹ Back to Home</Link>
      <div className="watch-player-shell">
        {isReady ? <video key={video.id} ref={playerRef} className="watch-player" controls playsInline preload="metadata" poster={thumbnailUrl} src={appPath(`/api/videos/${video.id}/media`)} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} onPlay={handlePlay} onPause={handlePause} onEnded={() => { void advanceToNext(); }} onError={() => { autoplayNext.current = false; setPlaybackMessage("This local video could not be played."); }} /> : <div className="watch-loading" style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.8)), url(${thumbnailUrl})` } : undefined}><span className="watch-loading-icon">▶</span><strong>{downloadLabel}</strong><p>{download?.status === "downloading" ? "Your video will begin as soon as local media is ready." : "This video is being acquired locally for private playback."}</p>{download?.progressPercent != null ? <div className="download-progress" role="progressbar" aria-valuenow={download.progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${download.progressPercent}%` }} /></div> : <div className="download-progress indeterminate"><span /></div>}</div>}
        {isReady ? <div className="player-settings-wrap"><button type="button" className="player-settings-button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>⚙ Settings</button>{settingsOpen ? <div className="player-settings" role="dialog" aria-label="Player settings"><strong>Sleep timer</strong>{SLEEP_OPTIONS.map((option) => <button key={option.label} type="button" className={sleepLabel === option.label ? "selected" : ""} onClick={() => chooseSleep(option.seconds, option.label)}>{option.label}{sleepLabel === option.label ? " ✓" : ""}</button>)}<small>Quality follows HomeTube’s local 720p-or-lower media policy. Start playback before locking your phone or switching apps; background playback follows your browser’s rules.</small></div> : null}</div> : null}
      </div>
      <audio ref={audioRef} className="watch-audio" preload="auto" aria-hidden="true" onLoadedMetadata={handleAudioLoadedMetadata} onTimeUpdate={handleAudioTimeUpdate} onPlay={handleAudioPlay} onPause={handleAudioPause} onEnded={handleAudioEnded} onError={() => { shouldPlayAudio.current = false; if (activeVideoRef.current.media?.state === "ready") setPlaybackMessage("This local media could not be played in the background."); }} />
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

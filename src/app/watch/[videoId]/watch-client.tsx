"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Video } from "@/domain/types";
import { appPath } from "../../app-path";
import { StatusPill } from "../../components/status-pill";

type DownloadStatus = { status: string; progressPercent: number | null; queuePosition: number | null } | null;
const SLEEP_OPTIONS = [{ label: "Off", seconds: null }, { label: "15 minutes", seconds: 900 }, { label: "30 minutes", seconds: 1800 }, { label: "60 minutes", seconds: 3600 }, { label: "End of video", seconds: -1 }] as const;

export function WatchClient({ initialVideo }: { initialVideo: Video }) {
  const [video, setVideo] = useState(initialVideo);
  const [download, setDownload] = useState<DownloadStatus>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sleepSeconds, setSleepSeconds] = useState<number | null>(null);
  const [sleepLabel, setSleepLabel] = useState("Off");
  const [message, setMessage] = useState("");
  const playerRef = useRef<HTMLVideoElement>(null);
  const lastProgress = useRef(0);
  const refreshInFlight = useRef(false);
  const isReady = video.media?.state === "ready";
  const thumbnailUrl = video.thumbnailUrl ? appPath(`/api/videos/${video.id}/thumbnail`) : undefined;
  const downloadLabel = useMemo(() => {
    if (download?.status === "queued") return download.queuePosition ? `Queued · position ${download.queuePosition}` : "Queued";
    if (download?.status === "downloading") return download.progressPercent == null ? "Downloading" : `Downloading · ${Math.round(download.progressPercent)}%`;
    if (download?.status === "failed") return "Download failed";
    if (download?.status === "unavailable") return "Media unavailable";
    return "Preparing local playback";
  }, [download]);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const response = await fetch(appPath(`/api/videos/${video.id}`), { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { video?: Video; download?: DownloadStatus };
      if (payload.video) setVideo(payload.video);
      if (payload.download !== undefined) setDownload(payload.download);
    } catch {
      // Keep the current download state when a background refresh is unavailable.
    } finally {
      refreshInFlight.current = false;
    }
  }, [video.id]);

  const requestDownload = useCallback(async () => {
    try {
      const response = await fetch(appPath(`/api/videos/${video.id}/actions`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "download" }) });
      const payload = await response.json() as { video?: Video; error?: string };
      if (!response.ok || !payload.video) throw new Error(payload.error ?? "Could not queue this video.");
      setVideo(payload.video);
      setMessage("Added to the front of the download queue.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not queue this video.");
    }
  }, [video.id]);

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

  async function saveProgress(positionSeconds: number, durationSeconds: number) {
    if (Math.abs(positionSeconds - lastProgress.current) < 8 && positionSeconds < durationSeconds - 2) return;
    lastProgress.current = positionSeconds;
    const response = await fetch(appPath(`/api/videos/${video.id}/progress`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionSeconds, durationSeconds }) });
    if (response.ok) {
      const payload = await response.json() as { video?: Video };
      if (payload.video) setVideo(payload.video);
    }
  }

  function chooseSleep(seconds: number | null, label: string) {
    setSleepSeconds(seconds);
    setSleepLabel(label);
    setSettingsOpen(false);
  }

  return (
    <div className="watch-page">
      <Link href={appPath("/")} className="watch-back">‹ Back to Home</Link>
      <div className="watch-player-shell">
        {isReady ? <video ref={playerRef} className="watch-player" controls preload="metadata" poster={thumbnailUrl} src={appPath(`/api/videos/${video.id}/media`)} onLoadedMetadata={(event) => { event.currentTarget.currentTime = video.progressSeconds; }} onTimeUpdate={(event) => { const player = event.currentTarget; void saveProgress(player.currentTime, player.duration || video.durationSeconds); }} /> : <div className="watch-loading" style={thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.8)), url(${thumbnailUrl})` } : undefined}><span className="watch-loading-icon">▶</span><strong>{downloadLabel}</strong><p>{download?.status === "downloading" ? "Your video will begin as soon as local media is ready." : "This video is being acquired locally for private playback."}</p>{download?.progressPercent != null ? <div className="download-progress" role="progressbar" aria-valuenow={download.progressPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${download.progressPercent}%` }} /></div> : <div className="download-progress indeterminate"><span /></div>}</div>}
        {isReady ? <div className="player-settings-wrap"><button type="button" className="player-settings-button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen}>⚙ Settings</button>{settingsOpen ? <div className="player-settings" role="dialog" aria-label="Player settings"><strong>Sleep timer</strong>{SLEEP_OPTIONS.map((option) => <button key={option.label} type="button" className={sleepLabel === option.label ? "selected" : ""} onClick={() => chooseSleep(option.seconds, option.label)}>{option.label}{sleepLabel === option.label ? " ✓" : ""}</button>)}<small>Quality follows HomeTube’s local 720p-or-lower media policy.</small></div> : null}</div> : null}
      </div>
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Video } from "@/domain/types";
import { StatusPill } from "./status-pill";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function safeThumbnail(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ["i.ytimg.com", "yt3.ggpht.com", "yt3.googleusercontent.com"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function VideoCard({ video, reason, onChanged }: { video: Video; reason?: string; onChanged?: (video: Video) => void }) {
  const [current, setCurrent] = useState(video);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lastProgress = useRef(0);
  const downloaded = current.media?.state === "ready";

  async function act(action: "watched" | "unwatched" | "pin" | "unpin" | "download" | "delete-media") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/videos/${current.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { video?: Video; error?: string };
      if (!response.ok || !payload.video) throw new Error(payload.error ?? "Action failed.");
      setCurrent(payload.video);
      onChanged?.(payload.video);
      setMessage(action === "download" ? "Queued" : action === "delete-media" ? "Removed locally" : "Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress(positionSeconds: number, durationSeconds: number) {
    if (Math.abs(positionSeconds - lastProgress.current) < 8 && positionSeconds < durationSeconds - 2) return;
    lastProgress.current = positionSeconds;
    try {
      const response = await fetch(`/api/videos/${current.id}/progress`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionSeconds, durationSeconds }) });
      if (response.ok) {
        const payload = await response.json() as { video?: Video };
        if (payload.video) {
          setCurrent(payload.video);
          onChanged?.(payload.video);
        }
      }
    } catch {
      // Playback remains usable when a transient progress request fails.
    }
  }

  return (
    <article className="video-card">
      <div className="video-thumb-wrap">
        {downloaded ? (
          <video
            className="video-player"
            controls
            preload="metadata"
            src={`/api/videos/${current.id}/media`}
            poster={safeThumbnail(current.thumbnailUrl) ? current.thumbnailUrl ?? undefined : undefined}
            onLoadedMetadata={(event) => { event.currentTarget.currentTime = current.progressSeconds; }}
            onTimeUpdate={(event) => { const player = event.currentTarget; void saveProgress(player.currentTime, player.duration || current.durationSeconds); }}
          />
        ) : safeThumbnail(current.thumbnailUrl) ? (
          <Image src={current.thumbnailUrl!} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" className="video-thumb" />
        ) : (
          <div className="video-thumb placeholder-thumb"><span>▶</span></div>
        )}
        <span className="duration-badge">{formatDuration(current.durationSeconds)}</span>
      </div>
      <div className="video-card-body">
        <div className="video-card-heading">
          <div>
            <Link href={`/channels/${current.channelId}`} className="eyebrow">{current.channelName}</Link>
            <h3>{current.title}</h3>
          </div>
          {current.watchState === "watched" ? <StatusPill tone="lime">Watched</StatusPill> : current.watchState === "in_progress" ? <StatusPill tone="amber">{Math.round(current.watchPercentage * 100)}% in</StatusPill> : <StatusPill>Unwatched</StatusPill>}
        </div>
        <p className="video-meta">{formatDate(current.publishedAt)} <span>·</span> {current.viewCount ? `${current.viewCount.toLocaleString()} views` : "Views unknown"}</p>
        {reason ? <p className="recommendation-reason">{reason}</p> : null}
        {current.watchPercentage > 0 && current.watchState !== "watched" ? <div className="progress-track" aria-label={`${Math.round(current.watchPercentage * 100)} percent watched`}><span style={{ width: `${Math.round(current.watchPercentage * 100)}%` }} /></div> : null}
        <div className="card-actions">
          {downloaded ? <button className="button button-quiet" type="button" onClick={() => void act("delete-media")} disabled={busy}>Remove local</button> : <button className="button button-primary" type="button" onClick={() => void act("download")} disabled={busy}>Acquire locally</button>}
          <button className="icon-button" type="button" aria-label={current.isPinned ? "Unpin video" : "Pin video"} onClick={() => void act(current.isPinned ? "unpin" : "pin")} disabled={busy}>{current.isPinned ? "★" : "☆"}</button>
          <button className="button button-quiet" type="button" onClick={() => void act(current.watchState === "watched" ? "unwatched" : "watched")} disabled={busy}>{current.watchState === "watched" ? "Mark unwatched" : "Mark watched"}</button>
        </div>
        <div className="card-footnote">{downloaded ? <StatusPill tone="lime">Downloaded · {current.media?.height}p</StatusPill> : <StatusPill>Not downloaded</StatusPill>}{current.isTrial ? <StatusPill tone="blue">Trial pick</StatusPill> : null}{message ? <span className="action-message">{message}</span> : null}</div>
      </div>
    </article>
  );
}


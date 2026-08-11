"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { thumbnailUrlForVideo } from "@/domain/thumbnails";
import type { Video } from "@/domain/types";
import { appPath } from "../app-path";
import { StatusPill } from "./status-pill";
import { shouldPreloadThumbnail } from "./thumbnail-loading";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "Date unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function VideoCard({ video, reason, position, onChanged }: { video: Video; reason?: string; position: number; onChanged?: (video: Video) => void }) {
  const [current, setCurrent] = useState(video);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const downloaded = current.media?.state === "ready";
  const thumbnailUrl = thumbnailUrlForVideo(current.thumbnailUrl, current.providerId);
  const preloadThumbnail = shouldPreloadThumbnail(position);
  const mediaState = current.media?.state;
  const mediaLabel = mediaState === "ready" ? `Downloaded · ${current.media?.height}p` : mediaState === "queued" ? "Queued" : mediaState === "downloading" ? "Downloading" : mediaState === "failed" ? "Download failed" : mediaState === "unavailable" ? "Unavailable" : "Not downloaded";

  async function act(action: "watched" | "unwatched" | "pin" | "unpin" | "download" | "cancel-download" | "delete-media") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(appPath(`/api/videos/${current.id}/actions`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { video?: Video; error?: string };
      if (!response.ok || !payload.video) throw new Error(payload.error ?? "Action failed.");
      setCurrent(payload.video);
      onChanged?.(payload.video);
      setMessage(action === "download" ? "Queued" : action === "cancel-download" ? "Cancelled" : action === "delete-media" ? "Removed locally" : "Saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="video-card">
      <div className="video-thumb-wrap">
        <Link href={appPath(`/watch/${current.id}`)} className="video-thumb-link" aria-label={`Watch ${current.title}`}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            className="video-thumb"
            unoptimized
            preload={preloadThumbnail}
            loading={preloadThumbnail ? "eager" : "lazy"}
            fetchPriority={preloadThumbnail ? "high" : "auto"}
          />
        ) : (
          <div className="video-thumb placeholder-thumb"><span>▶</span></div>
        )}
        <span className="duration-badge">{formatDuration(current.durationSeconds)}</span>
        {downloaded ? <span className="play-overlay" aria-hidden="true">â–¶</span> : null}
        </Link>
      </div>
      <div className="video-card-body">
        <div className="video-card-heading">
          <div>
            <Link href={appPath(`/channels/${current.channelId}`)} className="eyebrow">{current.channelName}</Link>
            <h3><Link href={appPath(`/watch/${current.id}`)}>{current.title}</Link></h3>
          </div>
          {current.watchState === "watched" ? <StatusPill tone="lime">Watched</StatusPill> : current.watchState === "in_progress" ? <StatusPill tone="amber">{Math.round(current.watchPercentage * 100)}% in</StatusPill> : <StatusPill>Unwatched</StatusPill>}
        </div>
        <p className="video-meta">{formatDate(current.publishedAt)} <span>·</span> {current.viewCount ? `${current.viewCount.toLocaleString()} views` : "Views unknown"}</p>
        {reason ? <p className="recommendation-reason">{reason}</p> : null}
        {current.watchPercentage > 0 && current.watchState !== "watched" ? <div className="progress-track" aria-label={`${Math.round(current.watchPercentage * 100)} percent watched`}><span style={{ width: `${Math.round(current.watchPercentage * 100)}%` }} /></div> : null}
        <div className="card-actions">
          {downloaded ? <button className="button button-quiet" type="button" onClick={() => void act("delete-media")} disabled={busy}>Remove local</button> : mediaState === "queued" || mediaState === "downloading" ? <button className="button button-quiet" type="button" onClick={() => void act("cancel-download")} disabled={busy}>Cancel download</button> : <button className="button button-primary" type="button" onClick={() => void act("download")} disabled={busy}>Acquire locally</button>}
          <button className="icon-button" type="button" aria-label={current.isPinned ? "Unpin video" : "Pin video"} onClick={() => void act(current.isPinned ? "unpin" : "pin")} disabled={busy}>{current.isPinned ? "★" : "☆"}</button>
          <button className="button button-quiet" type="button" onClick={() => void act(current.watchState === "watched" ? "unwatched" : "watched")} disabled={busy}>{current.watchState === "watched" ? "Mark unwatched" : "Mark watched"}</button>
        </div>
        <div className="card-footnote">{downloaded ? <StatusPill tone="lime">{mediaLabel}</StatusPill> : mediaState === "failed" ? <StatusPill tone="amber">{mediaLabel}</StatusPill> : mediaState === "downloading" ? <StatusPill tone="blue">{mediaLabel}</StatusPill> : <StatusPill>{mediaLabel}</StatusPill>}{current.isTrial ? <StatusPill tone="blue">Trial pick</StatusPill> : null}{message ? <span className="action-message">{message}</span> : null}</div>
      </div>
    </article>
  );
}

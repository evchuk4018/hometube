"use client";

import { useEffect, useMemo, useState } from "react";
import { isDownloadInProgress, isDownloadListed } from "@/domain/downloads";
import type { FeedVideo, Video } from "@/domain/types";
import { appPath } from "./app-path";
import { StatusPill } from "./components/status-pill";
import { VideoCard } from "./components/video-card";

export function HomeClient({ initialVideos, initialDownloads, generatedAt }: { initialVideos: FeedVideo[]; initialDownloads: Video[]; generatedAt: string }) {
  const [videos, setVideos] = useState(initialVideos);
  const [downloads, setDownloads] = useState(initialDownloads);
  const [filter, setFilter] = useState<"all" | "unwatched" | "in_progress" | "downloads">("all");
  const showingDownloads = filter === "downloads";
  const visible = useMemo(() => videos.filter((video) => filter === "all" || filter === "unwatched" && video.watchState === "unwatched" || filter === "in_progress" && video.watchState === "in_progress"), [filter, videos]);

  function updateVideo(next: Video) {
    setVideos((current) => current.map((video) => video.id === next.id ? { ...video, ...next } : video).filter((video) => video.watchState !== "watched"));
    setDownloads((current) => {
      if (!isDownloadListed(next)) return current.filter((video) => video.id !== next.id);
      return current.some((video) => video.id === next.id)
        ? current.map((video) => video.id === next.id ? { ...video, ...next } : video)
        : [next, ...current];
    });
  }

  useEffect(() => {
    if (!showingDownloads) return;
    let cancelled = false;

    async function refreshDownloads() {
      try {
        const response = await fetch(appPath("/api/downloads"), { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { videos?: Video[] };
        if (!cancelled && payload.videos) setDownloads(payload.videos);
      } catch {
        // The current list remains useful when a refresh is temporarily unavailable.
      }
    }

    void refreshDownloads();
    const interval = window.setInterval(() => void refreshDownloads(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showingDownloads]);

  const downloadedCount = downloads.filter((video) => video.media?.state === "ready").length;
  const inProgressDownloadCount = downloads.filter(isDownloadInProgress).length;
  const inProgressCount = videos.filter((video) => video.watchState === "in_progress").length;

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="kicker">Your quiet corner of the internet</p>
          <h1>Watch what matters.<br /><em>Keep it close.</em></h1>
          <p className="hero-copy">A personal feed shaped by the channels you actually spend time with, backed by a small local cache that stays ready when the network does not.</p>
        </div>
        <div className="hero-stats"><div><strong>{videos.length}</strong><span>active picks</span></div><div><strong>{downloadedCount}</strong><span>ready here</span></div><div><strong>{inProgressCount}</strong><span>in progress</span></div></div>
      </section>
      <section className="section-heading feed-heading">
        <div><p className="kicker">{showingDownloads ? `${inProgressDownloadCount} in progress · ${downloadedCount} ready` : `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(generatedAt))}`}</p><h2>{showingDownloads ? "Downloads" : "For you"}</h2></div>
        <div className="filter-row" role="group" aria-label="Filter Home feed">{([["all", "All"], ["unwatched", "Unwatched"], ["in_progress", "In progress"], ["downloads", "Downloads"]] as const).map(([value, label]) => <button key={value} type="button" className={`filter-button ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </section>
      {showingDownloads ? downloads.length ? <div className="video-grid">{downloads.map((video) => <VideoCard key={`${video.id}-${video.media?.state ?? "none"}`} video={video} onChanged={updateVideo} />)}</div> : <div className="empty-state"><span className="empty-icon">↓</span><h3>No downloads yet</h3><p>Videos you acquire locally will stay visible here while they queue, download, or finish.</p></div> : visible.length ? <div className="video-grid">{visible.map((video) => <VideoCard key={`${video.id}-${video.media?.state ?? "none"}`} video={video} reason={video.recommendationReason} onChanged={updateVideo} />)}</div> : <div className="empty-state"><span className="empty-icon">✓</span><h3>Feed cleared</h3><p>New recommendations will replenish this space after the next catalog sync.</p></div>}
      <div className="info-banner"><div className="info-symbol">128</div><div><strong>Small cache, large catalog</strong><p>HomeTube keeps metadata browsable even when a video is not downloaded. Local media is capped at 128 GiB and every download stays at or below 720p.</p></div><StatusPill tone="lime">Policy active</StatusPill></div>
    </>
  );
}

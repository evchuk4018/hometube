"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isDownloadInProgress, isDownloadListed, sortDownloads } from "@/domain/downloads";
import type { FeedVideo, Video } from "@/domain/types";
import { appPath } from "./app-path";
import { StatusPill } from "./components/status-pill";
import { VideoCard } from "./components/video-card";

export function HomeClient({ initialVideos, initialDownloads, generatedAt }: { initialVideos: FeedVideo[]; initialDownloads: Video[]; generatedAt: string }) {
  const [videos, setVideos] = useState(initialVideos);
  const [downloads, setDownloads] = useState(initialDownloads);
  const [feedGeneratedAt, setFeedGeneratedAt] = useState(generatedAt);
  const [filter, setFilter] = useState<"all" | "unwatched" | "in_progress" | "downloads">("all");
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const refreshInProgress = useRef(false);
  const showingDownloads = filter === "downloads";
  const visible = useMemo(() => videos.filter((video) => filter === "all" || filter === "unwatched" && video.watchState === "unwatched" || filter === "in_progress" && video.watchState === "in_progress"), [filter, videos]);

  async function refreshFeed() {
    if (refreshInProgress.current || showingDownloads) return;
    refreshInProgress.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch(appPath("/api/feed"), { cache: "no-store" });
      if (!response.ok) throw new Error("Feed refresh failed");
      const payload = await response.json() as { videos?: FeedVideo[]; generatedAt?: string };
      if (!payload.videos) throw new Error("Feed refresh returned no videos");
      setVideos(payload.videos);
      if (payload.generatedAt) setFeedGeneratedAt(payload.generatedAt);
    } catch {
      setRefreshError("Feed refresh failed. Showing the current recommendations.");
    } finally {
      refreshInProgress.current = false;
      setRefreshing(false);
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (showingDownloads || refreshing || window.scrollY > 0 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!touchStart.current || showingDownloads || refreshing || window.scrollY > 0 || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
      touchStart.current = null;
      setPullDistance(0);
      setPullReady(false);
      return;
    }
    event.preventDefault();
    const distance = Math.min(96, deltaY * 0.55);
    setPullDistance(distance);
    setPullReady(distance >= 72);
  }

  function handleTouchEnd() {
    const shouldRefresh = pullReady && !refreshing;
    touchStart.current = null;
    setPullDistance(0);
    setPullReady(false);
    if (shouldRefresh) void refreshFeed();
  }

  function updateVideo(next: Video) {
    setVideos((current) => current.map((video) => video.id === next.id ? { ...video, ...next } : video).filter((video) => video.watchState !== "watched"));
    setDownloads((current) => {
      if (!isDownloadListed(next)) return current.filter((video) => video.id !== next.id);
      const updated = current.some((video) => video.id === next.id)
        ? current.map((video) => video.id === next.id ? { ...video, ...next } : video)
        : [next, ...current];
      return sortDownloads(updated);
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
        if (!cancelled && payload.videos) setDownloads(sortDownloads(payload.videos));
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
    <div className="home-feed-shell" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>
      <div className={`pull-refresh-indicator ${refreshing ? "refreshing" : ""}`} style={{ height: pullDistance }} aria-live="polite">
        <span>{refreshing ? "Refreshing feed..." : pullReady ? "Release to refresh" : "Pull to refresh"}</span>
      </div>
      <section className="hero-panel">
        <div>
          <p className="kicker">Your quiet corner of the internet</p>
          <h1>Watch what matters.<br /><em>Keep it close.</em></h1>
          <p className="hero-copy">A personal feed shaped by the channels you actually spend time with, backed by a small local cache that stays ready when the network does not.</p>
        </div>
        <div className="hero-stats"><div><strong>{videos.length}</strong><span>active picks</span></div><div><strong>{downloadedCount}</strong><span>ready here</span></div><div><strong>{inProgressCount}</strong><span>in progress</span></div></div>
      </section>
      <section className="section-heading feed-heading">
        <div><p className="kicker">{showingDownloads ? `${inProgressDownloadCount} in progress · ${downloadedCount} ready` : refreshError ?? `Updated ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(feedGeneratedAt))}`}</p><h2>{showingDownloads ? "Downloads" : "For you"}</h2></div>
        <div className="filter-row" role="group" aria-label="Filter Home feed">{([["all", "All"], ["unwatched", "Unwatched"], ["in_progress", "In progress"], ["downloads", "Downloads"]] as const).map(([value, label]) => <button key={value} type="button" className={`filter-button ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}{!showingDownloads ? <button type="button" className="filter-button refresh-button" onClick={() => void refreshFeed()} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh feed"}</button> : null}</div>
      </section>
      {showingDownloads ? downloads.length ? <div className="video-grid">{downloads.map((video, position) => <VideoCard key={`${video.id}-${video.media?.state ?? "none"}`} video={video} position={position} onChanged={updateVideo} />)}</div> : <div className="empty-state"><span className="empty-icon">↓</span><h3>No downloads yet</h3><p>Videos you acquire locally will stay visible here while they queue, download, or finish.</p></div> : visible.length ? <div className="video-grid">{visible.map((video, position) => <VideoCard key={`${video.id}-${video.media?.state ?? "none"}`} video={video} position={position} reason={video.recommendationReason} onChanged={updateVideo} />)}</div> : <div className="empty-state"><span className="empty-icon">✓</span><h3>Feed cleared</h3><p>New recommendations will replenish this space after the next catalog sync.</p></div>}
      <div className="info-banner"><div className="info-symbol">128</div><div><strong>Small cache, large catalog</strong><p>HomeTube keeps metadata browsable even when a video is not downloaded. Local media is capped at 128 GiB and every download stays at or below 720p.</p></div><StatusPill tone="lime">Policy active</StatusPill></div>
    </div>
  );
}

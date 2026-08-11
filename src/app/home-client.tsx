"use client";

import { useMemo, useState } from "react";
import type { FeedVideo } from "@/domain/types";
import { StatusPill } from "./components/status-pill";
import { VideoCard } from "./components/video-card";

export function HomeClient({ initialVideos, generatedAt }: { initialVideos: FeedVideo[]; generatedAt: string }) {
  const [videos, setVideos] = useState(initialVideos);
  const [filter, setFilter] = useState<"all" | "unwatched" | "in_progress" | "downloaded">("all");
  const visible = useMemo(() => videos.filter((video) => filter === "all" || filter === "unwatched" && video.watchState === "unwatched" || filter === "in_progress" && video.watchState === "in_progress" || filter === "downloaded" && video.media?.state === "ready"), [filter, videos]);
  function updateVideo(next: FeedVideo) {
    setVideos((current) => current.map((video) => video.id === next.id ? { ...video, ...next } : video).filter((video) => video.watchState !== "watched"));
  }
  const downloadedCount = videos.filter((video) => video.media?.state === "ready").length;
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
        <div><p className="kicker">Updated {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(generatedAt))}</p><h2>For you</h2></div>
        <div className="filter-row" role="group" aria-label="Filter Home feed">{([["all", "All"], ["unwatched", "Unwatched"], ["in_progress", "In progress"], ["downloaded", "Downloaded"]] as const).map(([value, label]) => <button key={value} type="button" className={`filter-button ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </section>
      {visible.length ? <div className="video-grid">{visible.map((video) => <VideoCard key={video.id} video={video} reason={video.recommendationReason} onChanged={(next) => updateVideo({ ...video, ...next })} />)}</div> : <div className="empty-state"><span className="empty-icon">✓</span><h3>Feed cleared</h3><p>New recommendations will replenish this space after the next catalog sync.</p></div>}
      <div className="info-banner"><div className="info-symbol">128</div><div><strong>Small cache, large catalog</strong><p>HomeTube keeps metadata browsable even when a video is not downloaded. Local media is capped at 128 GiB and every download stays at or below 720p.</p></div><StatusPill tone="lime">Policy active</StatusPill></div>
    </>
  );
}


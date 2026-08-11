"use client";

import Link from "next/link";
import type { Channel, Video } from "@/domain/types";
import { StatusPill } from "./components/status-pill";
import { VideoGrid } from "./components/video-grid";

export function ChannelDetailClient({ channel, videos }: { channel: Channel; videos: Video[] }) {
  return <><Link href="/channels" className="back-link">← All channels</Link><section className="channel-detail-hero"><div className="large-channel-avatar">{channel.name.slice(0, 1)}</div><div><p className="kicker">{channel.handle ?? channel.providerId}</p><h1>{channel.name}</h1><p className="lede">{channel.description ?? "No description available yet."}</p><div className="badge-row">{channel.isPodcast ? <StatusPill tone="amber">Podcast channel</StatusPill> : null}{channel.isRetained ? <StatusPill tone="lime">Retained</StatusPill> : null}{channel.isPinned ? <StatusPill tone="blue">Pinned</StatusPill> : null}<StatusPill>{videos.length} catalog entries shown</StatusPill></div></div></section><section className="section-heading"><div><p className="kicker">Metadata catalog</p><h2>Recent uploads</h2></div><p className="muted-copy">Local files: {videos.filter((video) => video.media?.state === "ready").length} / {videos.length}</p></section><VideoGrid videos={videos} /></>;
}


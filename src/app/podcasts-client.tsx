"use client";

import Link from "next/link";
import type { Channel, Video } from "@/domain/types";
import { VideoCard } from "./components/video-card";

function EpisodeSection({ title, subtitle, videos }: { title: string; subtitle: string; videos: Video[] }) {
  return <section className="podcast-section"><div className="section-heading"><div><p className="kicker">{subtitle}</p><h2>{title}</h2></div><span className="section-count">{videos.length}</span></div>{videos.length ? <div className="video-grid">{videos.map((video) => <VideoCard key={video.id} video={video} />)}</div> : <div className="empty-state compact"><h3>All clear</h3><p>Nothing in this section.</p></div>}</section>;
}

export function PodcastsClient({ channels, unwatched, inProgress, completed }: { channels: Channel[]; unwatched: Video[]; inProgress: Video[]; completed: Video[] }) {
  return <><section className="page-intro split-intro"><div><p className="kicker">Always acquired, quietly kept</p><h1>Podcasts</h1><p className="lede">Podcast channels bypass recommendation pruning. New episodes download automatically, unfinished episodes are protected, and completed media can leave the cache without losing your history.</p></div><div className="catalog-count"><strong>{channels.length}</strong><span>podcast channels</span></div></section><section className="podcast-channel-strip"><div><p className="kicker">Your channels</p><div className="podcast-channel-list">{channels.map((channel) => <Link key={channel.id} href={`/channels/${channel.id}`} className="podcast-channel-chip"><span>{channel.name.slice(0, 1)}</span>{channel.name}</Link>)}</div></div><div className="podcast-policy"><strong>Protected while listening</strong><span>Unwatched + in-progress episodes outrank ordinary cache content.</span></div></section><EpisodeSection title="Up next" subtitle="Unwatched episodes" videos={unwatched} /><EpisodeSection title="Keep going" subtitle="In progress" videos={inProgress} /><EpisodeSection title="Archive" subtitle="Completed episodes" videos={completed} /></>;
}


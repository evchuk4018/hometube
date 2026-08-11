"use client";

import Link from "next/link";
import { useState } from "react";
import type { Channel, Video } from "@/domain/types";
import { appPath } from "./app-path";
import { VideoCard } from "./components/video-card";

function EpisodeSection({ title, subtitle, videos }: { title: string; subtitle: string; videos: Video[] }) {
  return (
    <section className="podcast-section">
      <div className="section-heading">
        <div><p className="kicker">{subtitle}</p><h2>{title}</h2></div>
        <span className="section-count">{videos.length}</span>
      </div>
      {videos.length ? (
        <div className="video-grid">{videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>
      ) : (
        <div className="empty-state compact"><h3>All clear</h3><p>Nothing in this section.</p></div>
      )}
    </section>
  );
}

export function PodcastsClient({ channels, unwatched, inProgress, completed }: { channels: Channel[]; unwatched: Video[]; inProgress: Video[]; completed: Video[] }) {
  const [podcastChannels, setPodcastChannels] = useState(channels);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function channelAction(channel: Channel, action: "pin" | "unpin" | "normal") {
    if (action === "normal" && !window.confirm(`Stop podcasting ${channel.name}? New episodes will no longer download automatically.`)) return;
    setBusyChannelId(channel.id);
    setMessage("");
    try {
      const response = await fetch(appPath(`/api/channels/${channel.id}/actions`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = await response.json() as { channel?: Channel; error?: string };
      if (!response.ok || !payload.channel) throw new Error(payload.error ?? "Action failed.");
      if (action === "normal") setPodcastChannels((current) => current.filter((item) => item.id !== channel.id));
      else setPodcastChannels((current) => current.map((item) => item.id === channel.id ? payload.channel! : item));
      setMessage(action === "normal" ? `${channel.name} is now a normal channel.` : `${channel.name} ${action === "pin" ? "pinned" : "unpinned"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusyChannelId(null);
    }
  }

  return (
    <>
      <section className="page-intro split-intro">
        <div>
          <p className="kicker">Always acquired, quietly kept</p>
          <h1>Podcasts</h1>
          <p className="lede">Podcast channels bypass recommendation pruning. New episodes download automatically, unfinished episodes are protected, and completed media can leave the cache without losing your history.</p>
        </div>
        <div className="catalog-count"><strong>{podcastChannels.length}</strong><span>podcast channels</span></div>
      </section>
      <section className="podcast-channel-strip">
        <div>
          <p className="kicker">Your channels</p>
          <div className="podcast-channel-list">
            {podcastChannels.map((channel) => (
              <div key={channel.id} className="podcast-channel-item">
                <Link href={appPath("/channels/" + channel.id)} className="podcast-channel-chip"><span>{channel.name.slice(0, 1)}</span>{channel.name}</Link>
                <div className="podcast-channel-actions">
                  <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, channel.isPinned ? "unpin" : "pin")} disabled={busyChannelId === channel.id}>{channel.isPinned ? "Unpin" : "Pin"}</button>
                  <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, "normal")} disabled={busyChannelId === channel.id}>Stop podcasting</button>
                </div>
              </div>
            ))}
          </div>
          {message ? <p className="action-message">{message}</p> : null}
        </div>
        <div className="podcast-policy"><strong>Protected while listening</strong><span>Unwatched + in-progress episodes outrank ordinary cache content.</span></div>
      </section>
      <EpisodeSection title="Up next" subtitle="Unwatched episodes" videos={unwatched} />
      <EpisodeSection title="Keep going" subtitle="In progress" videos={inProgress} />
      <EpisodeSection title="Archive" subtitle="Completed episodes" videos={completed} />
    </>
  );
}

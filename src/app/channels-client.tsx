"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Channel } from "@/domain/types";
import { appPath } from "./app-path";
import { StatusPill } from "./components/status-pill";

export function ChannelsClient({ initialChannels }: { initialChannels: Channel[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [query, setQuery] = useState("");
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const visible = useMemo(
    () => channels.filter((channel) => (channel.name + " " + channel.providerId).toLowerCase().includes(query.toLowerCase())),
    [channels, query]
  );

  async function channelAction(channel: Channel, action: "retain" | "unretain" | "prune" | "unprune" | "remove" | "restore" | "podcast" | "normal" | "pin" | "unpin") {
    try {
      const response = await fetch(appPath("/api/channels/" + channel.id + "/actions"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = await response.json() as { channel?: Channel; error?: string };
      if (!response.ok || !payload.channel) throw new Error(payload.error ?? "Action failed.");
      setChannels((current) => current.map((item) => item.id === channel.id ? payload.channel! : item));
      setMessage(payload.channel.name + " updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function addChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(appPath("/api/channels"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId, name })
      });
      const payload = await response.json() as { channel?: Channel; error?: string };
      if (!response.ok || !payload.channel) throw new Error(payload.error ?? "Could not add channel.");
      setChannels((current) => [payload.channel!, ...current]);
      setProviderId("");
      setName("");
      setMessage("Channel added. The worker will fill its catalog shortly.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add channel.");
    }
  }

  return (
    <>
      <section className="page-intro split-intro">
        <div>
          <p className="kicker">The catalog</p>
          <h1>Channels</h1>
          <p className="lede">Every known source lives here: subscriptions, seeds, trials, discoveries, and podcasts. Browse metadata without filling the cache.</p>
        </div>
        <div className="catalog-count"><strong>{channels.length}</strong><span>known channels</span></div>
      </section>
      <section className="add-channel-panel">
        <div>
          <p className="kicker">Bring something in</p>
          <h2>Add a channel</h2>
          <p>Use a YouTube channel ID or @handle. Downloads stay opt-in unless you turn it into a podcast.</p>
        </div>
        <form className="inline-form" onSubmit={addChannel}>
          <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Channel name" /></label>
          <label><span>ID or handle</span><input value={providerId} onChange={(event) => setProviderId(event.target.value)} required placeholder="@channel" /></label>
          <button className="button button-primary" type="submit">Add channel</button>
        </form>
      </section>
      <div className="toolbar">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" aria-label="Search channels" /></label>
        {message ? <span className="action-message">{message}</span> : null}
      </div>
      <section className="channel-grid">
        {visible.map((channel) => (
          <article className={"channel-card " + (channel.isPodcast ? "podcast-card" : "")} key={channel.id}>
            <div className="channel-card-top">
              <div className="channel-avatar">{channel.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <Link href={appPath("/channels/" + channel.id)}><h2>{channel.name}</h2></Link>
                <p>{channel.handle ?? channel.providerId}</p>
              </div>
              {channel.isPodcast ? <StatusPill tone="amber">Podcast</StatusPill> : channel.isPruned ? <StatusPill>Pruned</StatusPill> : channel.isRetained ? <StatusPill tone="lime">Retained</StatusPill> : <StatusPill>Seed</StatusPill>}
            </div>
            <div className="channel-metrics">
              <div><strong>{Math.round(channel.averagePercentageWatched * 100)}%</strong><span>avg watched</span></div>
              <div><strong>{channel.videosWatched}</strong><span>watched</span></div>
              <div><strong>{channel.recentEngagement > 0 ? Math.round(channel.recentEngagement * 100) + "%" : "—"}</strong><span>recent signal</span></div>
            </div>
            <div className="channel-actions">
              <Link className="button button-quiet" href={appPath("/channels/" + channel.id)}>Browse catalog</Link>
              <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, channel.isPinned ? "unpin" : "pin")}>{channel.isPinned ? "Unpin" : "Pin"}</button>
              <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, channel.isPodcast ? "normal" : "podcast")}>{channel.isPodcast ? "Make normal" : "Make podcast"}</button>
              <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, channel.isRetained ? "unretain" : "retain")}>{channel.isRetained ? "Release" : "Retain"}</button>
              <button className="button button-quiet" type="button" onClick={() => void channelAction(channel, channel.isPruned ? "restore" : "remove")}>{channel.isPruned ? "Restore" : "Remove from feed"}</button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

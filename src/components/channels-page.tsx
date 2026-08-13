import Image from 'next/image';
import Link from 'next/link';
import type { ChannelSummary } from '@/protocol/schemas';
import { ChannelEntryForm } from './channel-entry-form';
import { BrandMark } from './channel-browser';

export function ChannelsPage({ channels }: { channels: ChannelSummary[] }) {
  return (
    <main className="channels-page app-page-with-nav">
      <header className="app-header"><Link className="brand-link" href="/"><BrandMark /><span>HomeTube</span></Link></header>
      <section className="channels-intro">
        <p className="eyebrow">YOUR SUBSCRIPTIONS</p>
        <h1>Channels</h1>
        <ChannelEntryForm />
      </section>
      <section className="subscribed-channels" aria-label="Subscribed channels">
        {channels.map((channel) => (
          <Link className="subscribed-channel" href={`/channels/${channel.id}`} key={channel.id}>
            <span className="small-avatar">
              {channel.thumbnailUrl
                ? <Image src={channel.thumbnailUrl} alt="" fill sizes="56px" />
                : channel.name.slice(0, 1).toUpperCase()}
            </span>
            <span><strong>{channel.name}</strong><small>{channel.handle ?? `${channel.videoCount.toLocaleString()} videos`}</small></span>
            <span className="chevron">›</span>
          </Link>
        ))}
        {channels.length === 0 && <div className="channels-empty"><p>No subscriptions yet.</p><span>Add your first YouTube channel above.</span></div>}
      </section>
    </main>
  );
}

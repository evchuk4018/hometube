import Link from 'next/link';
import { ChannelEntryForm } from '@/components/channel-entry-form';
import { BrandMark } from '@/components/channel-browser';
import { listRecentChannels } from '@/server/channels/channel-repository';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const channels = await listRecentChannels();
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-brand"><BrandMark /><span>HomeTube</span></div>
        <p className="eyebrow">YOUR PRIVATE VIDEO SHELF</p>
        <h1>Bring a channel home.</h1>
        <p className="hero-copy">Paste a YouTube channel URL to browse its videos, download one to homelab, and play the local copy.</p>
        <ChannelEntryForm />
      </section>
      {channels.length > 0 && (
        <section className="recent-channels">
          <div className="section-heading"><h2>Recent channels</h2><span>{channels.length}</span></div>
          <div className="channel-list">
            {channels.map((channel) => (
              <Link href={`/channels/${channel.id}`} key={channel.id}>
                <span className="small-avatar">{channel.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{channel.name}</strong><small>{channel.videoCount.toLocaleString()} videos · {channel.readyCount} local</small></span>
                <span className="chevron">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}


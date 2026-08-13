import { ChannelEntryForm } from '@/components/channel-entry-form';
import { BrandMark } from '@/components/channel-browser';

export default async function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-brand"><BrandMark /><span>HomeTube</span></div>
        <p className="eyebrow">YOUR PRIVATE VIDEO SHELF</p>
        <h1>Bring a channel home.</h1>
        <p className="hero-copy">Paste a YouTube channel URL to browse uploads from the last 7 days, download one to homelab, and play the local copy.</p>
        <ChannelEntryForm />
      </section>
    </main>
  );
}

import { FeedBrowser } from '@/components/feed-browser';
import { BrandMark } from '@/components/channel-browser';
import { getHomeFeed } from '@/server/feed/feed-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const payload = await getHomeFeed(40);
  return (
    <main className="feed-page app-page-with-nav">
      <header className="app-header"><div className="home-brand"><BrandMark /><span>HomeTube</span></div></header>
      <FeedBrowser initialPayload={payload} />
    </main>
  );
}

import { FeedBrowser } from '@/components/feed-browser';
import { BrandMark } from '@/components/channel-browser';
import { shouldResumeCurrentPlaybackSession } from '@/domain/playback-session';
import { getHomeFeed } from '@/server/feed/feed-service';
import { getCurrentVideoId } from '@/server/playback/playback-session-repository';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headerList = await headers();
  if (shouldResumeCurrentPlaybackSession(headerList.get('referer'), headerList.get('host'))) {
    const currentVideoId = await getCurrentVideoId();
    if (currentVideoId) redirect(`/watch/${currentVideoId}`);
  }

  const payload = await getHomeFeed(40);
  return (
    <main className="feed-page app-page-with-nav">
      <header className="app-header"><div className="home-brand"><BrandMark /><span>HomeTube</span></div></header>
      <FeedBrowser initialPayload={payload} />
    </main>
  );
}

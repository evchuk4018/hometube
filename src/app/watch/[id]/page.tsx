import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoPlayer } from '@/components/video-player';
import { getVideo } from '@/server/channels/channel-repository';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideo(id);
  return { title: video?.title ?? 'Video' };
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const video = await getVideo(id);
  if (!video) notFound();

  if (video.mediaStatus !== 'ready') {
    return <main className="watch-unavailable"><h1>This video is not ready yet.</h1><Link href={`/channels/${video.channelId}`}>Return to {video.channelName}</Link></main>;
  }

  return (
    <main className="watch-page">
      <VideoPlayer video={video} />
      <section className="watch-metadata">
        <h1>{video.title}</h1>
        <Link href={`/channels/${video.channelId}`}>{video.channelName}</Link>
      </section>
    </main>
  );
}


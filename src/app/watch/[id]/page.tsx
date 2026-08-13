import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WatchExperience } from '@/components/watch-experience';
import { getChannel, getVideo } from '@/server/channels/channel-repository';

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

  const channel = await getChannel(video.channelId);
  return <WatchExperience initialVideo={video} subscribed={channel?.subscribed ?? false} />;
}

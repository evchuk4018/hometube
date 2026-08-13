import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChannelBrowser } from '@/components/channel-browser';
import { getChannelPage } from '@/server/channels/channel-service';
import { NotFoundError } from '@/server/protocol/http';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const payload = await getChannelPage(id, 1);
    return { title: payload.channel.name };
  } catch {
    return { title: 'Channel' };
  }
}

export default async function ChannelPage({ params }: Props) {
  let payload;
  try {
    const { id } = await params;
    payload = await getChannelPage(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return <ChannelBrowser initialPayload={payload} />;
}

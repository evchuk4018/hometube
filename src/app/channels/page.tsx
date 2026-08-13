import { ChannelsPage } from '@/components/channels-page';
import { getSubscribedChannels } from '@/server/channels/channel-service';

export const dynamic = 'force-dynamic';

export default async function ChannelsRoute() {
  return <ChannelsPage channels={await getSubscribedChannels()} />;
}

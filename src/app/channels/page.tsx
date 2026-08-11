import { ChannelsClient } from "../channels-client";
import { getChannelsData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  return <ChannelsClient initialChannels={await getChannelsData()} />;
}


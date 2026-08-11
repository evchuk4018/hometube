import { ChannelsClient } from "../channels-client";
import { getChannelsData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return <ChannelsClient initialChannels={await getChannelsData()} initialQuery={initialQuery} />;
}

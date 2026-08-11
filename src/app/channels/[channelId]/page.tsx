import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelDetailClient } from "../../channel-detail-client";
import { getChannelData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ channelId: string }> }): Promise<Metadata> {
  const { channelId } = await params;
  const { channel } = await getChannelData(channelId);
  return { title: channel?.name ?? "Channel" };
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const data = await getChannelData(channelId);
  if (!data.channel) notFound();
  return <ChannelDetailClient channel={data.channel} videos={data.videos} />;
}


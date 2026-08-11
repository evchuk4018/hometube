import { notFound } from "next/navigation";
import { findVideoById } from "@/server/repositories/video-repository";
import { WatchClient } from "./watch-client";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const video = await findVideoById(videoId);
  if (!video) notFound();
  return <WatchClient initialVideo={video} />;
}

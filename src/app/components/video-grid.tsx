import type { Video } from "@/domain/types";
import { VideoCard } from "./video-card";

export function VideoGrid({ videos, reasons }: { videos: Video[]; reasons?: Map<string, string> }) {
  if (!videos.length) return <div className="empty-state"><span className="empty-icon">◌</span><h3>Nothing here yet</h3><p>Metadata will appear when the worker syncs your channels.</p></div>;
  return <div className="video-grid">{videos.map((video) => <VideoCard key={video.id} video={video} reason={reasons?.get(video.id)} />)}</div>;
}


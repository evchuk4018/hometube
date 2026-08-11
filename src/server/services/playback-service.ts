import { selectNextPlaybackVideo } from "@/domain/playback";
import { listPlaybackCandidates } from "../repositories/video-repository";

export async function getNextPlaybackVideo(excludeVideoId?: string): Promise<ReturnType<typeof selectNextPlaybackVideo>> {
  const candidates = await listPlaybackCandidates();
  return selectNextPlaybackVideo(candidates, excludeVideoId);
}

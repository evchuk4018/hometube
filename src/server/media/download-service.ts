import { ConflictError, NotFoundError } from '@/server/protocol/http';
import { getVideo } from '@/server/channels/channel-repository';
import { enqueueVideoDownload } from '@/server/jobs/job-repository';

export async function requestVideoDownload(videoId: string) {
  const video = await getVideo(videoId);
  if (!video) throw new NotFoundError('Video not found.');
  if (!video.downloadable) throw new ConflictError('Live, upcoming, or unavailable videos cannot be downloaded.');
  if (video.mediaStatus === 'ready') return { ready: true, job: null };
  const job = await enqueueVideoDownload(video.id, video.channelId);
  return { ready: false, job };
}


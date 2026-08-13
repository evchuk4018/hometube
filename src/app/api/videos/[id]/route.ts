import { getVideo } from '@/server/channels/channel-repository';
import { apiError, NotFoundError } from '@/server/protocol/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const video = await getVideo(id);
    if (!video) throw new NotFoundError('Video not found.');
    return Response.json(video, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

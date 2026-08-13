import { playbackProgressRequestSchema } from '@/protocol/schemas';
import { updatePlaybackProgress } from '@/server/feed/feed-service';
import { apiError } from '@/server/protocol/http';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body] = await Promise.all([params, request.json()]);
    const progress = playbackProgressRequestSchema.parse(body);
    return Response.json(await updatePlaybackProgress(id, progress.positionSeconds, progress.durationSeconds));
  } catch (error) {
    return apiError(error);
  }
}

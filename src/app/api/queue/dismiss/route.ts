import { queueDismissRequestSchema } from '@/protocol/schemas';
import { apiError } from '@/server/protocol/http';
import { dismissQueueEntry } from '@/server/queue/queue-service';

export async function POST(request: Request) {
  try {
    const { currentVideoId, videoId } = queueDismissRequestSchema.parse(await request.json());
    return Response.json({ entries: await dismissQueueEntry(currentVideoId, videoId) });
  } catch (error) {
    return apiError(error);
  }
}

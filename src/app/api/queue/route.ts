import { queueUpdateRequestSchema } from '@/protocol/schemas';
import { apiError } from '@/server/protocol/http';
import { buildAndStoreQueue, getQueue } from '@/server/queue/queue-service';

export async function GET() {
  try {
    return Response.json({ entries: await getQueue() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { currentVideoId } = queueUpdateRequestSchema.parse(await request.json());
    return Response.json({ entries: await buildAndStoreQueue(currentVideoId) });
  } catch (error) {
    return apiError(error);
  }
}

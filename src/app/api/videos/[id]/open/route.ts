import { openVideo } from '@/server/feed/feed-service';
import { apiError } from '@/server/protocol/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await openVideo(id);
    return Response.json({ recorded: true });
  } catch (error) {
    return apiError(error);
  }
}

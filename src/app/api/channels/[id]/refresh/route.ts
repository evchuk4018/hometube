import { refreshChannel } from '@/server/channels/channel-service';
import { apiError } from '@/server/protocol/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await refreshChannel(id), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}


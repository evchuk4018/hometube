import { channelUrlRequestSchema } from '@/protocol/schemas';
import { addChannel } from '@/server/channels/channel-service';
import { apiError } from '@/server/protocol/http';

export async function POST(request: Request) {
  try {
    const body = channelUrlRequestSchema.parse(await request.json());
    return Response.json(await addChannel(body.url), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}


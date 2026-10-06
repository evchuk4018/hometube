import { channelUrlRequestSchema } from '@/protocol/schemas';
import { addChannel, getSubscribedChannels } from '@/server/channels/channel-service';
import { apiError } from '@/server/protocol/http';

export async function POST(request: Request) {
  try {
    const body = channelUrlRequestSchema.parse(await request.json());
    return Response.json(await addChannel(body.url), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET() {
  try {
    return Response.json(
      { channels: await getSubscribedChannels() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiError(error);
  }
}


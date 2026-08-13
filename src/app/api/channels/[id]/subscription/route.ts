import { subscriptionRequestSchema } from '@/protocol/schemas';
import { updateSubscription } from '@/server/channels/channel-service';
import { apiError } from '@/server/protocol/http';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body] = await Promise.all([params, request.json()]);
    const { subscribed } = subscriptionRequestSchema.parse(body);
    return Response.json(await updateSubscription(id, subscribed));
  } catch (error) {
    return apiError(error);
  }
}

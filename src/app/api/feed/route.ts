import { feedImpressionsRequestSchema, feedQuerySchema } from '@/protocol/schemas';
import { addFeedImpressions, getHomeFeed } from '@/server/feed/feed-service';
import { apiError } from '@/server/protocol/http';

export async function GET(request: Request) {
  try {
    const query = feedQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await getHomeFeed(query.limit), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = feedImpressionsRequestSchema.parse(await request.json());
    return Response.json(await addFeedImpressions(body.videoIds));
  } catch (error) {
    return apiError(error);
  }
}

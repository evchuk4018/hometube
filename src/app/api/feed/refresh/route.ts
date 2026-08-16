import { feedQuerySchema, feedRefreshRequestSchema } from '@/protocol/schemas';
import { refreshHomeFeed } from '@/server/feed/feed-service';
import { apiError } from '@/server/protocol/http';

export async function POST(request: Request) {
  try {
    const body = feedRefreshRequestSchema.parse(await request.json());
    const query = feedQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await refreshHomeFeed(body.videoIds, query.limit), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

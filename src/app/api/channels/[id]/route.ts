import { getChannelPage } from '@/server/channels/channel-service';
import { apiError } from '@/server/protocol/http';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const search = new URL(request.url).searchParams;
    const limit = Math.min(200, Math.max(1, Number(search.get('limit') ?? 50) || 50));
    const offset = Math.max(0, Number(search.get('offset') ?? 0) || 0);
    return Response.json(await getChannelPage(id, limit, offset), {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return apiError(error);
  }
}


import { requestVideoDownload } from '@/server/media/download-service';
import { apiError } from '@/server/protocol/http';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await requestVideoDownload(id), { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}


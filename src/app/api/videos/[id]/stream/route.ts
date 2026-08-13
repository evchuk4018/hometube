import { mediaResponse } from '@/server/media/media-service';
import { apiError } from '@/server/protocol/http';

async function respond(request: Request, params: Promise<{ id: string }>, head: boolean) {
  try {
    const { id } = await params;
    return await mediaResponse(id, request, head);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(request, params, false);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return respond(request, params, true);
}


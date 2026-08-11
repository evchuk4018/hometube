import { requirePrivateAccess } from "@/server/auth";
import { actionSchema } from "@/server/validation";
import { performVideoAction } from "@/server/services/video-service";

export async function POST(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  try {
    const { videoId } = await params;
    const { action } = actionSchema.parse(await request.json());
    const video = await performVideoAction(videoId, action);
    if (!video) return Response.json({ error: "Video not found." }, { status: 404 });
    return Response.json({ video });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid video action." }, { status: 400 });
  }
}


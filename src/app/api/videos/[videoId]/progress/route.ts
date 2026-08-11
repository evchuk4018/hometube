import { requirePrivateAccess } from "@/server/auth";
import { progressSchema } from "@/server/validation";
import { recordProgress } from "@/server/services/video-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  try {
    const { videoId } = await params;
    const input = progressSchema.parse(await request.json());
    const video = await recordProgress({ videoId, ...input });
    if (!video) return Response.json({ error: "Video not found." }, { status: 404 });
    return Response.json({ video });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid playback progress." }, { status: 400 });
  }
}


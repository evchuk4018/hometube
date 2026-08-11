import { requirePrivateAccess } from "@/server/auth";
import { getNextPlaybackVideo } from "@/server/services/playback-service";
import { playbackNextQuerySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;

  try {
    const query = new URL(request.url).searchParams;
    const { excludeVideoId } = playbackNextQuerySchema.parse({
      excludeVideoId: query.get("excludeVideoId") ?? undefined
    });
    return Response.json({ video: await getNextPlaybackVideo(excludeVideoId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid playback queue request." }, { status: 400 });
  }
}

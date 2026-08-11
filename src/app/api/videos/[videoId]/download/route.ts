import { requirePrivateAccess } from "@/server/auth";
import { requestDownload } from "@/server/services/download-service";

export async function POST(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  try {
    const { videoId } = await params;
    await requestDownload(videoId);
    return Response.json({ queued: true, videoId }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to queue download." }, { status: 400 });
  }
}


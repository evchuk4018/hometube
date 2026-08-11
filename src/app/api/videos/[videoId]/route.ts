import { requirePrivateAccess } from "@/server/auth";
import { findVideoById } from "@/server/repositories/video-repository";
import { findDownloadStatus } from "@/server/repositories/download-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { videoId } = await params;
  const video = await findVideoById(videoId);
  if (!video) return Response.json({ error: "Video not found." }, { status: 404 });
  return Response.json({ video, download: await findDownloadStatus(videoId) });
}

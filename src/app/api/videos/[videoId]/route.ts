import { requirePrivateAccess } from "@/server/auth";
import { findVideoById } from "@/server/repositories/video-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { videoId } = await params;
  const video = await findVideoById(videoId);
  return video ? Response.json({ video }) : Response.json({ error: "Video not found." }, { status: 404 });
}


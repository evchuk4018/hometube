import { promises as fs } from "node:fs";
import { requirePrivateAccess } from "@/server/auth";
import { thumbnailUrlForVideo } from "@/domain/thumbnails";
import { findVideoById } from "@/server/repositories/video-repository";
import { expectedThumbnailPath } from "@/server/services/media-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { videoId } = await params;
  const video = await findVideoById(videoId);
  if (!video) return Response.json({ error: "Video not found." }, { status: 404 });

  try {
    const image = await fs.readFile(expectedThumbnailPath(videoId));
    return new Response(image, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    const remote = thumbnailUrlForVideo(video.thumbnailUrl, video.providerId);
    return remote ? Response.redirect(remote, 307) : Response.json({ error: "Thumbnail is unavailable." }, { status: 404 });
  }
}

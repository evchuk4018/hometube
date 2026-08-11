import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { requirePrivateAccess } from "@/server/auth";
import { findReadyMedia, deleteMediaRecord, markMediaAccessed } from "@/server/repositories/media-repository";
import { removeLocalVideoAssets } from "@/server/services/media-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { videoId } = await params;
  const media = await findReadyMedia(videoId);
  if (!media) return Response.json({ error: "Media is not downloaded." }, { status: 404 });
  let stat;
  try {
    stat = await fs.stat(media.path);
  } catch {
    return Response.json({ error: "Media file is unavailable." }, { status: 404 });
  }
  await markMediaAccessed(videoId);
  const range = request.headers.get("range");
  const parsed = range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (parsed) {
    start = parsed[1] ? Number(parsed[1]) : 0;
    end = parsed[2] ? Number(parsed[2]) : end;
    if (parsed[1] === "" && parsed[2]) start = Math.max(0, stat.size - Number(parsed[2]));
    end = Math.min(end, stat.size - 1);
    if (start > end || start < 0) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    status = 206;
  }
  const stream = createReadStream(media.path, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}),
      "Cache-Control": "private, max-age=3600"
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ videoId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { videoId } = await params;
  const media = await findReadyMedia(videoId);
  if (!media) return Response.json({ deleted: false, reason: "not_downloaded" });
  await removeLocalVideoAssets(videoId, media.path);
  await deleteMediaRecord(videoId);
  return Response.json({ deleted: true, videoId });
}

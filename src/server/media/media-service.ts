import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { parseByteRange } from '@/domain/media-range';
import { getMediaFile } from './media-repository';
import { resolveMediaPath } from './media-path';
import { NotFoundError } from '@/server/protocol/http';

export async function mediaResponse(videoId: string, request: Request, head = false): Promise<Response> {
  const media = await getMediaFile(videoId);
  if (!media) throw new NotFoundError('Local media not found.');
  const filePath = resolveMediaPath(media.relativePath);
  const details = await stat(filePath).catch(() => null);
  if (!details?.isFile()) throw new NotFoundError('Local media file is missing.');
  const size = details.size;
  let range;
  try {
    range = parseByteRange(request.headers.get('range'), size);
  } catch (error) {
    if (error instanceof RangeError) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' } });
    }
    throw error;
  }

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': media.contentType,
    'Cache-Control': 'private, max-age=0, must-revalidate'
  });
  if (!range) {
    headers.set('Content-Length', String(size));
    const body = head ? null : Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(body, { status: 200, headers });
  }

  const length = range.end - range.start + 1;
  headers.set('Content-Length', String(length));
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  const body = head ? null : Readable.toWeb(createReadStream(filePath, { start: range.start, end: range.end })) as ReadableStream;
  return new Response(body, { status: 206, headers });
}

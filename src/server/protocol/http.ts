import { ZodError } from 'zod';
import { InvalidChannelUrlError } from '@/domain/youtube-url';

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

export function apiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  }
  if (error instanceof InvalidChannelUrlError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof NotFoundError) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof ConflictError) return Response.json({ error: error.message }, { status: 409 });
  console.error(error);
  return Response.json({ error: 'Something went wrong.' }, { status: 500 });
}


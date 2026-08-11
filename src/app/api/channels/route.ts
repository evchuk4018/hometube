import { requirePrivateAccess } from "@/server/auth";
import { listChannels } from "@/server/repositories/channel-repository";
import { addChannel } from "@/server/services/channel-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const search = new URL(request.url).searchParams.get("q") ?? undefined;
  return Response.json({ channels: await listChannels(search) });
}

export async function POST(request: Request): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  try {
    const channel = await addChannel(await request.json());
    return Response.json({ channel }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid channel." }, { status: 400 });
  }
}


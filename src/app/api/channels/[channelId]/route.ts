import { requirePrivateAccess } from "@/server/auth";
import { getChannelData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  const { channelId } = await params;
  const data = await getChannelData(channelId);
  if (!data.channel) return Response.json({ error: "Channel not found." }, { status: 404 });
  return Response.json(data);
}


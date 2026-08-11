import { requirePrivateAccess } from "@/server/auth";
import { channelActionSchema } from "@/server/validation";
import { performChannelAction, pinChannel } from "@/server/services/channel-service";

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  try {
    const { channelId } = await params;
    const parsed = channelActionSchema.parse(await request.json());
    const channel = parsed.action === "pin" ? await pinChannel(channelId, true) : parsed.action === "unpin" ? await pinChannel(channelId, false) : await performChannelAction(channelId, parsed.action);
    if (!channel) return Response.json({ error: "Channel not found." }, { status: 404 });
    return Response.json({ channel });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid channel action." }, { status: 400 });
  }
}


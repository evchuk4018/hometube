import { requirePrivateAccess } from "@/server/auth";
import { getDownloadsData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const denied = requirePrivateAccess(request);
  if (denied) return denied;
  return Response.json({ videos: await getDownloadsData() }, { headers: { "Cache-Control": "no-store" } });
}

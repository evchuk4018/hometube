import { hasDatabase } from "@/server/config";
import { query } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!hasDatabase()) return Response.json({ status: "degraded", database: "not_configured" }, { status: 200 });
  try {
    await query("SELECT 1");
    return Response.json({ status: "healthy", database: "ready" });
  } catch (error) {
    return Response.json({ status: "unhealthy", database: "unavailable", error: error instanceof Error ? error.message : "database check failed" }, { status: 503 });
  }
}


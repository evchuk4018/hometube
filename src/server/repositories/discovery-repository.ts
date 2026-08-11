import { query } from "../db";

export async function lastDiscoveryAt(): Promise<Date | null> {
  const result = await query<{ requested_at: Date }>(`SELECT requested_at FROM ai_discoveries ORDER BY requested_at DESC LIMIT 1`);
  return result.rows[0]?.requested_at ? new Date(result.rows[0].requested_at) : null;
}

export async function createDiscovery(input: { model: string; context: unknown }): Promise<string> {
  const result = await query<{ id: string }>(`INSERT INTO ai_discoveries (model, status, context) VALUES ($1, 'requested', $2) RETURNING id`, [input.model, JSON.stringify(input.context)]);
  return result.rows[0].id;
}

export async function completeDiscovery(id: string, proposals: unknown): Promise<void> {
  await query(`UPDATE ai_discoveries SET status = 'completed', proposals = $2, completed_at = now() WHERE id = $1`, [id, JSON.stringify(proposals)]);
}

export async function failDiscovery(id: string, error: string): Promise<void> {
  await query(`UPDATE ai_discoveries SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`, [id, error]);
}

export async function recordChannelEvaluation(input: { channelId: string; discoveryId: string; justification: string; outcome: "candidate" | "trial" | "promoted" | "pruned" | "rejected" }): Promise<void> {
  await query(`INSERT INTO channel_evaluations (channel_id, discovery_id, justification, outcome) VALUES ($1, $2, $3, $4)`, [input.channelId, input.discoveryId, input.justification, input.outcome]);
}

export async function listRejectedProviderIds(): Promise<string[]> {
  const result = await query<{ provider_id: string }>(
    `SELECT DISTINCT c.provider_id FROM channels c JOIN channel_evaluations e ON e.channel_id = c.id WHERE e.outcome IN ('rejected', 'pruned') OR c.is_pruned = true`
  );
  return result.rows.map((row) => row.provider_id);
}

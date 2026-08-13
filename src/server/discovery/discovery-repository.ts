import { randomUUID } from 'node:crypto';
import { query } from '@/server/db/client';

export async function startDiscoveryRun(requestedCount: number): Promise<string> {
  const id = randomUUID();
  await query('INSERT INTO discovery_runs (id, requested_count) VALUES ($1, $2)', [id, requestedCount]);
  return id;
}

export async function recordDiscoveryCandidate(input: {
  runId: string;
  name: string;
  sourceUrl: string | null;
  reason: string | null;
  status: 'proposed' | 'duplicate' | 'invalid' | 'accepted';
  channelId?: string | null;
}): Promise<void> {
  await query(`
    INSERT INTO discovery_candidates (id, run_id, name, source_url, reason, status, channel_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [randomUUID(), input.runId, input.name, input.sourceUrl, input.reason, input.status, input.channelId ?? null]);
}

export async function completeDiscoveryRun(runId: string, model: string | null): Promise<void> {
  await query(`
    UPDATE discovery_runs SET status = 'ready', model = $2, completed_at = now() WHERE id = $1
  `, [runId, model]);
}

export async function failDiscoveryRun(runId: string, model: string | null, error: string): Promise<void> {
  await query(`
    UPDATE discovery_runs SET status = 'failed', model = $2, error = $3, completed_at = now() WHERE id = $1
  `, [runId, model, error.slice(0, 500)]);
}

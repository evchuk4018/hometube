import type { Channel, ChannelSource } from "@/domain/types";
import { query } from "../db";
import { mapChannelRow } from "../row-mappers";

const channelColumns = `
  id, provider_id, name, handle, description, thumbnail_url, source,
  is_subscribed, is_retained, is_pruned, is_podcast, is_pinned,
  trial_started_at, trial_ends_at, videos_presented, videos_opened,
  videos_watched, average_percentage_watched, recent_engagement,
  last_interaction_at, rejection_count, last_rejection_reason,
  last_ai_justification
`;

export async function listChannels(search?: string): Promise<Channel[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT ${channelColumns} FROM channels
     WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR provider_id ILIKE '%' || $1 || '%')
     ORDER BY is_podcast DESC, is_retained DESC, name ASC`,
    [search?.trim() || null]
  );
  return result.rows.map(mapChannelRow);
}

export async function findChannelById(id: string): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(`SELECT ${channelColumns} FROM channels WHERE id = $1`, [id]);
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function findChannelByProviderId(providerId: string): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(`SELECT ${channelColumns} FROM channels WHERE provider_id = $1`, [providerId]);
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function createChannel(input: {
  providerId: string;
  name: string;
  handle?: string;
  thumbnailUrl?: string;
  source?: ChannelSource;
}): Promise<Channel> {
  const result = await query<Record<string, unknown>>(
    `INSERT INTO channels (provider_id, name, handle, thumbnail_url, source, is_subscribed, is_retained)
     VALUES ($1, $2, $3, $4, $5, true, true)
     ON CONFLICT (provider_id) DO UPDATE SET
       name = EXCLUDED.name,
       handle = COALESCE(EXCLUDED.handle, channels.handle),
       thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, channels.thumbnail_url),
       updated_at = now()
     RETURNING ${channelColumns}`,
    [input.providerId, input.name, input.handle ?? null, input.thumbnailUrl ?? null, input.source ?? "user_added"]
  );
  return mapChannelRow(result.rows[0]);
}

export async function setChannelRetention(id: string, retained: boolean): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE channels SET is_retained = $2, is_pruned = CASE WHEN $2 THEN false ELSE is_pruned END, updated_at = now()
     WHERE id = $1 RETURNING ${channelColumns}`,
    [id, retained]
  );
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function setChannelPruned(id: string, pruned: boolean): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE channels SET is_pruned = $2,
       rejection_count = rejection_count + CASE WHEN $2 AND NOT is_pruned THEN 1 ELSE 0 END,
       last_rejection_reason = CASE WHEN $2 AND NOT is_pruned THEN 'channel pruned from active recommendations' ELSE last_rejection_reason END,
       updated_at = now() WHERE id = $1 RETURNING ${channelColumns}`,
    [id, pruned]
  );
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function removeChannelFromRecommendations(id: string, restore: boolean): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE channels SET is_subscribed = CASE WHEN $2 THEN is_subscribed ELSE false END,
       is_retained = CASE WHEN $2 THEN true ELSE false END,
       is_pruned = NOT $2,
       rejection_count = rejection_count + CASE WHEN $2 THEN 0 ELSE 1 END,
       last_rejection_reason = CASE WHEN $2 THEN last_rejection_reason ELSE 'channel removed from normal recommendations' END,
       updated_at = now() WHERE id = $1 RETURNING ${channelColumns}`,
    [id, restore]
  );
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function promoteTrialChannel(id: string): Promise<void> {
  await query(`UPDATE channels SET is_retained = true, is_pruned = false, trial_ends_at = NULL, updated_at = now() WHERE id = $1`, [id]);
}

export async function recordChannelPresentation(channelId: string): Promise<void> {
  await query(`UPDATE channels SET videos_presented = videos_presented + 1, updated_at = now() WHERE id = $1`, [channelId]);
}

export async function setPodcastMode(id: string, podcast: boolean): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE channels
     SET source = CASE WHEN $2 THEN 'podcast' ELSE COALESCE(source_before_podcast, 'user_added') END,
         source_before_podcast = CASE WHEN $2 THEN source ELSE source_before_podcast END,
         is_podcast = $2,
         is_pruned = CASE WHEN $2 THEN false ELSE is_pruned END,
         updated_at = now()
     WHERE id = $1
     RETURNING ${channelColumns}`,
    [id, podcast]
  );
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function setChannelPinned(id: string, pinned: boolean): Promise<Channel | null> {
  const result = await query<Record<string, unknown>>(
    `UPDATE channels SET is_pinned = $2, is_retained = CASE WHEN $2 THEN true ELSE is_retained END, updated_at = now()
     WHERE id = $1 RETURNING ${channelColumns}`,
    [id, pinned]
  );
  return result.rows[0] ? mapChannelRow(result.rows[0]) : null;
}

export async function recordChannelEngagement(input: { channelId: string; opened?: boolean; watched?: boolean; percentage?: number }): Promise<void> {
  const percentage = Math.min(1, Math.max(0, input.percentage ?? 0));
  await query(
    `UPDATE channels
     SET videos_opened = videos_opened + CASE WHEN $2 THEN 1 ELSE 0 END,
         videos_watched = videos_watched + CASE WHEN $3 THEN 1 ELSE 0 END,
         average_percentage_watched = CASE
           WHEN $4 > 0 THEN ((average_percentage_watched * GREATEST(videos_opened, 0)) + $4) / (GREATEST(videos_opened, 0) + 1)
           ELSE average_percentage_watched
         END,
         recent_engagement = LEAST(1, (recent_engagement * 0.8) + CASE WHEN $2 OR $3 THEN 0.2 ELSE 0 END),
         last_interaction_at = now(), updated_at = now()
     WHERE id = $1`,
    [input.channelId, Boolean(input.opened), Boolean(input.watched), percentage]
  );
}

export async function listPodcastChannels(): Promise<Channel[]> {
  const result = await query<Record<string, unknown>>(`SELECT ${channelColumns} FROM channels WHERE is_podcast = true ORDER BY name ASC`);
  return result.rows.map(mapChannelRow);
}

export async function listDiscoveryChannels(limit: number): Promise<Channel[]> {
  const result = await query<Record<string, unknown>>(
    `SELECT ${channelColumns} FROM channels WHERE is_pruned = false ORDER BY
      ((LN(1 + videos_watched) * 1.5) + average_percentage_watched + recent_engagement + CASE WHEN is_retained THEN 0.5 ELSE 0 END) DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapChannelRow);
}

export async function startChannelTrial(id: string, endsAt: Date): Promise<void> {
  await query(
    `UPDATE channels SET trial_started_at = COALESCE(trial_started_at, now()), trial_ends_at = $2, is_pruned = false, updated_at = now() WHERE id = $1`,
    [id, endsAt]
  );
}

export async function rememberChannelRejection(id: string, reason: string, justification?: string): Promise<void> {
  await query(
    `UPDATE channels SET rejection_count = rejection_count + 1, last_rejection_reason = $2, last_ai_justification = COALESCE($3, last_ai_justification), updated_at = now() WHERE id = $1`,
    [id, reason, justification ?? null]
  );
}

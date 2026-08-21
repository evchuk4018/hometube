import { randomUUID } from 'node:crypto';
import { query, transaction } from '@/server/db/client';
import type { JobSummary } from '@/protocol/schemas';

export type JobType = 'import_channel' | 'download_video' | 'discover_channels';
export type ClaimedJob = JobSummary & {
  channelId: string | null;
  videoId: string | null;
  attemptCount: number;
};

type JobRow = {
  id: string;
  type: JobType;
  status: JobSummary['status'];
  progress: string;
  stage: string;
  error: string | null;
  channel_id: string | null;
  video_id: string | null;
  attempt_count: number;
};

function mapJob(row: JobRow): ClaimedJob {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    progress: Number(row.progress),
    stage: row.stage,
    error: row.error,
    channelId: row.channel_id,
    videoId: row.video_id,
    attemptCount: row.attempt_count
  };
}

export async function enqueueChannelImport(channelId: string): Promise<JobSummary> {
  const rows = await query<JobRow>(`
    INSERT INTO jobs (id, type, channel_id)
    VALUES ($1, 'import_channel', $2)
    ON CONFLICT (channel_id) WHERE type = 'import_channel' AND status IN ('queued', 'running')
    DO UPDATE SET
      status = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'queued' ELSE jobs.status END,
      lease_owner = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_owner END,
      lease_expires_at = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_expires_at END,
      stage = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'Queued' ELSE jobs.stage END,
      updated_at = now()
    RETURNING *
  `, [randomUUID(), channelId]);
  return mapJob(rows[0]);
}

export async function enqueueVideoDownload(videoId: string, channelId: string): Promise<JobSummary> {
  const rows = await query<JobRow>(`
    INSERT INTO jobs (id, type, channel_id, video_id)
    VALUES ($1, 'download_video', $2, $3)
    ON CONFLICT (video_id) WHERE type = 'download_video' AND status IN ('queued', 'running')
    DO UPDATE SET
      status = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'queued' ELSE jobs.status END,
      lease_owner = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_owner END,
      lease_expires_at = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_expires_at END,
      stage = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'Queued' ELSE jobs.stage END,
      updated_at = now()
    RETURNING *
  `, [randomUUID(), channelId, videoId]);
  await query(`UPDATE videos SET media_status = 'queued', media_error = NULL, updated_at = now() WHERE id = $1`, [videoId]);
  return mapJob(rows[0]);
}

export async function enqueueChannelDiscovery(): Promise<JobSummary> {
  const rows = await query<JobRow>(`
    INSERT INTO jobs (id, type)
    VALUES ($1, 'discover_channels')
    ON CONFLICT (type) WHERE type = 'discover_channels' AND status IN ('queued', 'running')
    DO UPDATE SET
      status = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'queued' ELSE jobs.status END,
      lease_owner = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_owner END,
      lease_expires_at = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN NULL ELSE jobs.lease_expires_at END,
      stage = CASE WHEN jobs.status = 'running' AND (jobs.lease_expires_at IS NULL OR jobs.lease_expires_at < now()) THEN 'Queued' ELSE jobs.stage END,
      updated_at = now()
    RETURNING *
  `, [randomUUID()]);
  return mapJob(rows[0]);
}

export async function scheduleDueJobs(now = new Date()): Promise<void> {
  const subscribedMs = positiveNumber(process.env.CHANNEL_REFRESH_SUBSCRIBED_MS, 6 * 60 * 60 * 1000);
  const trialMs = positiveNumber(process.env.CHANNEL_REFRESH_TRIAL_MS, 24 * 60 * 60 * 1000);
  const discoveryMs = positiveNumber(process.env.CHANNEL_DISCOVERY_INTERVAL_MS, 7 * 24 * 60 * 60 * 1000);
  const discoveryRetryMs = positiveNumber(process.env.CHANNEL_DISCOVERY_RETRY_MS, 6 * 60 * 60 * 1000);
  await query(`
    INSERT INTO jobs (id, type, channel_id)
    SELECT gen_random_uuid(), 'import_channel', c.id
    FROM channels c
    WHERE (c.is_subscribed = true AND COALESCE(c.last_imported_at, '-infinity') < $1::timestamptz)
       OR (c.trial_status = 'active' AND COALESCE(c.last_imported_at, '-infinity') < $2::timestamptz)
    ON CONFLICT (channel_id) WHERE type = 'import_channel' AND status IN ('queued', 'running')
    DO NOTHING
  `, [new Date(now.getTime() - subscribedMs), new Date(now.getTime() - trialMs)]);
  const due = await query<{ due: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM channels)
      AND NOT EXISTS (
        SELECT 1 FROM discovery_runs WHERE status = 'ready' AND started_at >= $1
      )
      AND NOT EXISTS (
        SELECT 1 FROM discovery_runs WHERE started_at >= $2
      ) AS due
  `, [new Date(now.getTime() - discoveryMs), new Date(now.getTime() - discoveryRetryMs)]);
  if (due[0]?.due) await enqueueChannelDiscovery();
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getJob(jobId: string): Promise<JobSummary | null> {
  const rows = await query<JobRow>('SELECT * FROM jobs WHERE id = $1', [jobId]);
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function getActiveChannelJob(channelId: string): Promise<JobSummary | null> {
  const rows = await query<JobRow>(`
    SELECT * FROM jobs
    WHERE channel_id = $1 AND type = 'import_channel' AND status IN ('queued', 'running')
    ORDER BY created_at DESC LIMIT 1
  `, [channelId]);
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function getActiveVideoDownloadJobs(videoIds: string[]): Promise<Array<{ job: JobSummary; videoId: string }>> {
  if (videoIds.length === 0) return [];
  const rows = await query<JobRow>(`
    SELECT * FROM jobs
    WHERE type = 'download_video' AND video_id = ANY($1::text[])
      AND status IN ('queued', 'running')
  `, [videoIds]);
  return rows.map((row) => ({ job: mapJob(row), videoId: row.video_id ?? '' }));
}

export async function claimNextJob(workerId: string): Promise<ClaimedJob | null> {
  return transaction(async (client) => {
    const result = await client.query<JobRow>(`
      SELECT * FROM jobs
      WHERE (
        (status = 'queued' AND attempt_count < 3)
        OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < now()))
      )
      ORDER BY CASE type WHEN 'download_video' THEN 0 WHEN 'import_channel' THEN 1 ELSE 2 END, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    if (!result.rows[0]) return null;
    const claimed = await client.query<JobRow>(`
      UPDATE jobs SET status = 'running', attempt_count = attempt_count + 1,
        lease_owner = $2, lease_expires_at = now() + interval '5 minutes',
        stage = CASE
          WHEN type = 'import_channel' THEN 'Reading channel'
          WHEN type = 'discover_channels' THEN 'Finding channels'
          ELSE 'Starting download'
        END,
        error = NULL, updated_at = now()
      WHERE id = $1 RETURNING *
    `, [result.rows[0].id, workerId]);
    return mapJob(claimed.rows[0]);
  });
}

export async function updateJobProgress(jobId: string, progress: number, stage: string): Promise<void> {
  await query(`
    UPDATE jobs SET progress = $2, stage = $3, lease_expires_at = now() + interval '5 minutes', updated_at = now()
    WHERE id = $1 AND status = 'running'
  `, [jobId, Math.min(99.9, Math.max(0, progress)), stage]);
}

export async function completeJob(jobId: string, stage = 'Ready'): Promise<void> {
  await query(`
    UPDATE jobs SET status = 'ready', progress = 100, stage = $2, error = NULL,
      lease_owner = NULL, lease_expires_at = NULL, completed_at = now(), updated_at = now()
    WHERE id = $1
  `, [jobId, stage]);
}

export async function failJob(job: ClaimedJob, message: string): Promise<void> {
  const retry = job.attemptCount < 3;
  await query(`
    UPDATE jobs SET status = $2, stage = $3, error = $4,
      lease_owner = NULL, lease_expires_at = NULL, updated_at = now(),
      completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END
    WHERE id = $1
  `, [job.id, retry ? 'queued' : 'failed', retry ? 'Retrying' : 'Failed', message]);
}

export async function reapStuckJobs(): Promise<number> {
  const stuck = await query<{ id: string }>(`
    UPDATE jobs SET status = 'failed', stage = 'Failed', error = 'Exceeded retry limit',
      lease_owner = NULL, lease_expires_at = NULL, completed_at = now(), updated_at = now()
    WHERE status = 'queued' AND attempt_count >= 3
    RETURNING id
  `);
  if (stuck.length > 0) {
    await query(`
      UPDATE videos SET media_status = 'failed', media_error = 'Exceeded retry limit', updated_at = now()
      WHERE id IN (SELECT video_id FROM jobs WHERE id = ANY($1::uuid[]))
        AND media_status IN ('queued', 'downloading')
    `, [stuck.map((r) => r.id)]);
  }
  // Requeue orphaned videos that appear queued but have no active job for >10 minutes
  await query(`
    UPDATE videos SET media_status = 'failed', media_error = 'Download stalled - please retry', updated_at = now()
    WHERE media_status IN ('queued', 'downloading')
      AND updated_at < now() - interval '10 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM jobs j WHERE j.video_id = videos.id AND j.type = 'download_video' AND j.status IN ('queued', 'running')
      )
  `);
  return stuck.length;
}

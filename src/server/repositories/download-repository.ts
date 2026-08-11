import { query, withTransaction } from "../db";

export type DownloadJob = {
  id: string;
  videoId: string;
  providerId: string;
  kind: "auto" | "manual" | "podcast";
  status: "queued" | "downloading" | "ready" | "failed" | "unavailable" | "cancelled";
  attempts: number;
  progressPercent: number | null;
};

export type DownloadStatus = {
  status: DownloadJob["status"];
  progressPercent: number | null;
  queuePosition: number | null;
};

export async function cancelDownload(videoId: string): Promise<{ cancelled: boolean; path: string | null }> {
  const result = await query<{ path: string | null }>(
    `WITH cancelled AS (
       UPDATE download_jobs
       SET status = 'cancelled', error_message = 'Download cancelled by user', completed_at = now()
       WHERE video_id = $1 AND status IN ('queued', 'downloading')
       RETURNING video_id
     )
     UPDATE media_files m
     SET state = 'deleted', updated_at = now()
     FROM cancelled
     WHERE m.video_id = cancelled.video_id AND m.state IN ('queued', 'downloading')
     RETURNING m.path`,
    [videoId]
  );
  return { cancelled: result.rowCount !== 0, path: result.rows[0]?.path ?? null };
}

export async function isDownloadCancelled(id: string): Promise<boolean> {
  const result = await query<{ status: string }>(`SELECT status FROM download_jobs WHERE id = $1`, [id]);
  return result.rows[0]?.status === "cancelled";
}

export async function completeDownload(input: { jobId: string; videoId: string; path: string; bytes: number; height: number; mimeType: string }): Promise<boolean> {
  const result = await query(
    `WITH completed AS (
       UPDATE download_jobs
       SET status = 'ready', error_message = NULL, completed_at = now()
       WHERE id = $1 AND video_id = $2 AND status = 'downloading'
       RETURNING video_id
     )
     UPDATE media_files m
     SET path = $3, bytes = $4, height = $5, mime_type = $6, state = 'ready',
       error_message = NULL, downloaded_at = now(), last_accessed_at = now(), updated_at = now()
     FROM completed
     WHERE m.video_id = completed.video_id
     RETURNING m.video_id`,
    [input.jobId, input.videoId, input.path, input.bytes, input.height, input.mimeType]
  );
  return result.rowCount !== 0;
}

export async function enqueueDownload(videoId: string, kind: DownloadJob["kind"], priority = kind === "podcast" ? 200 : kind === "manual" ? 300 : 0): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO media_files (video_id, path, state) VALUES ($1, '', 'queued')
       ON CONFLICT (video_id) DO UPDATE SET state = CASE WHEN media_files.state = 'ready' THEN media_files.state ELSE 'queued' END, error_message = NULL, updated_at = now()`,
      [videoId]
    );
    await client.query(
      `INSERT INTO download_jobs (video_id, kind, status, priority) VALUES ($1, $2, 'queued', $3)
       ON CONFLICT (video_id) WHERE status IN ('queued', 'downloading') DO UPDATE SET kind = EXCLUDED.kind, priority = GREATEST(download_jobs.priority, EXCLUDED.priority)`,
      [videoId, kind, priority]
    );
    if (kind === "manual") {
      await client.query(
        `WITH cancelled AS (
           UPDATE download_jobs
           SET status = 'cancelled', error_message = 'Paused for manual download', completed_at = now()
           WHERE kind IN ('auto', 'podcast') AND status = 'downloading'
           RETURNING video_id
         )
         UPDATE media_files m
         SET state = 'deleted', updated_at = now()
         FROM cancelled
         WHERE m.video_id = cancelled.video_id AND m.state = 'downloading'`
      );
    }
  });
}

export async function cancelQueuedPodcastBacklog(channelId: string, podcastStartedAt: string): Promise<number> {
  const result = await query(
    `WITH cancelled AS (
       DELETE FROM download_jobs j
       USING videos v
       WHERE j.video_id = v.id
         AND v.channel_id = $1
         AND j.kind = 'podcast'
         AND j.status = 'queued'
         AND (v.published_at IS NULL OR v.published_at <= $2::timestamptz)
       RETURNING j.video_id
     )
     UPDATE media_files m
     SET state = 'deleted', updated_at = now()
     FROM cancelled
     WHERE m.video_id = cancelled.video_id AND m.state = 'queued'`,
    [channelId, podcastStartedAt]
  );
  return result.rowCount ?? 0;
}

export async function cancelQueuedPodcastDownloads(channelId: string): Promise<number> {
  const result = await query(
    `WITH cancelled AS (
       DELETE FROM download_jobs j
       USING videos v
       WHERE j.video_id = v.id
         AND v.channel_id = $1
         AND j.kind = 'podcast'
         AND j.status = 'queued'
       RETURNING j.video_id
     )
     UPDATE media_files m
     SET state = 'deleted', path = '', error_message = 'Podcast download cancelled because the channel is no longer a podcast', updated_at = now()
     FROM cancelled
     WHERE m.video_id = cancelled.video_id AND m.state = 'queued'`,
    [channelId]
  );
  return result.rowCount ?? 0;
}

export async function claimNextDownload(): Promise<DownloadJob | null> {
  const result = await query<Record<string, unknown>>(
    `WITH next_job AS (
      SELECT j.id FROM download_jobs j JOIN videos v ON v.id = j.video_id JOIN channels c ON c.id = v.channel_id
      WHERE j.status = 'queued' ORDER BY j.priority DESC,
        (c.is_podcast AND v.watch_state IN ('unwatched', 'in_progress')) DESC, j.requested_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE download_jobs j SET status = 'downloading', started_at = now(), attempts = attempts + 1, progress_percent = 0
    FROM next_job WHERE j.id = next_job.id
    RETURNING j.id, j.video_id, j.kind, j.status, j.attempts,
      (SELECT provider_id FROM videos WHERE id = j.video_id) AS provider_id, j.progress_percent`,
    []
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    videoId: String(row.video_id),
    providerId: String(row.provider_id),
    kind: row.kind as DownloadJob["kind"],
    status: row.status as DownloadJob["status"],
    attempts: Number(row.attempts),
    progressPercent: row.progress_percent == null ? null : Number(row.progress_percent)
  };
}

export async function updateDownloadProgress(jobId: string, progressPercent: number): Promise<void> {
  await query(`UPDATE download_jobs SET progress_percent = $2 WHERE id = $1 AND status = 'downloading'`, [jobId, Math.max(0, Math.min(100, progressPercent))]);
}

export async function findDownloadStatus(videoId: string): Promise<DownloadStatus | null> {
  const result = await query<{ status: DownloadJob["status"]; progress_percent: string | null; queue_position: string | null }>(
    `SELECT j.status, j.progress_percent,
       CASE WHEN j.status = 'queued' THEN (
         SELECT COUNT(*) + 1 FROM download_jobs queued
         WHERE queued.status = 'queued' AND (queued.priority > j.priority OR (queued.priority = j.priority AND queued.requested_at < j.requested_at))
       ) ELSE NULL END AS queue_position
     FROM download_jobs j WHERE j.video_id = $1 ORDER BY j.requested_at DESC LIMIT 1`, [videoId]
  );
  const row = result.rows[0];
  return row ? { status: row.status, progressPercent: row.progress_percent == null ? null : Number(row.progress_percent), queuePosition: row.queue_position == null ? null : Number(row.queue_position) } : null;
}

export async function finishDownload(id: string, status: Extract<DownloadJob["status"], "ready" | "failed" | "unavailable">, error?: string): Promise<void> {
  await query(`UPDATE download_jobs SET status = $2, error_message = $3, completed_at = now() WHERE id = $1 AND status = 'downloading'`, [id, status, error ?? null]);
}

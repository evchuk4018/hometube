import { query } from "../db";

export type DownloadJob = {
  id: string;
  videoId: string;
  providerId: string;
  kind: "auto" | "manual" | "podcast";
  status: "queued" | "downloading" | "ready" | "failed" | "unavailable";
  attempts: number;
};

export async function enqueueDownload(videoId: string, kind: DownloadJob["kind"]): Promise<void> {
  await query(
    `INSERT INTO download_jobs (video_id, kind, status) VALUES ($1, $2, 'queued')
     ON CONFLICT (video_id) WHERE status IN ('queued', 'downloading') DO UPDATE SET kind = EXCLUDED.kind`,
    [videoId, kind]
  );
}

export async function claimNextDownload(): Promise<DownloadJob | null> {
  const result = await query<Record<string, unknown>>(
    `WITH next_job AS (
      SELECT j.id FROM download_jobs j JOIN videos v ON v.id = j.video_id JOIN channels c ON c.id = v.channel_id
      WHERE j.status = 'queued' ORDER BY (c.is_podcast AND v.watch_state IN ('unwatched', 'in_progress')) DESC,
        CASE j.kind WHEN 'podcast' THEN 0 WHEN 'manual' THEN 1 ELSE 2 END, j.requested_at ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE download_jobs j SET status = 'downloading', started_at = now(), attempts = attempts + 1
    FROM next_job WHERE j.id = next_job.id
    RETURNING j.id, j.video_id, j.kind, j.status, j.attempts,
      (SELECT provider_id FROM videos WHERE id = j.video_id) AS provider_id`,
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
    attempts: Number(row.attempts)
  };
}

export async function finishDownload(id: string, status: Extract<DownloadJob["status"], "ready" | "failed" | "unavailable">, error?: string): Promise<void> {
  await query(`UPDATE download_jobs SET status = $2, error_message = $3, completed_at = now() WHERE id = $1`, [id, status, error ?? null]);
}


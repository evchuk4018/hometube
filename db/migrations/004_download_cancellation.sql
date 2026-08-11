ALTER TABLE download_jobs DROP CONSTRAINT IF EXISTS download_jobs_status_check;

ALTER TABLE download_jobs
  ADD CONSTRAINT download_jobs_status_check
  CHECK (status IN ('queued', 'downloading', 'ready', 'failed', 'unavailable', 'cancelled'));

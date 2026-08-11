ALTER TABLE download_jobs ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE download_jobs ADD COLUMN IF NOT EXISTS progress_percent numeric(5,2);

CREATE INDEX IF NOT EXISTS download_jobs_priority_idx
  ON download_jobs (status, priority DESC, requested_at);

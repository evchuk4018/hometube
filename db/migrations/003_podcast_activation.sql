ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS podcast_started_at timestamptz;

-- Existing podcast channels already have a catalog. Start their new-download
-- window at migration time so the first post-migration sync does not enqueue
-- the historical backlog.
UPDATE channels
SET podcast_started_at = now()
WHERE is_podcast AND podcast_started_at IS NULL;

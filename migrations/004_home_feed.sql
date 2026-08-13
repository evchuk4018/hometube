ALTER TABLE channels
  ADD COLUMN source text NOT NULL DEFAULT 'user_added'
    CHECK (source IN ('user_added', 'ai_recommendation')),
  ADD COLUMN is_subscribed boolean NOT NULL DEFAULT true,
  ADD COLUMN trial_status text NOT NULL DEFAULT 'none'
    CHECK (trial_status IN ('none', 'active', 'evaluated', 'dismissed')),
  ADD COLUMN discovered_at timestamptz,
  ADD COLUMN evaluated_at timestamptz,
  ADD COLUMN discovery_reason text;

CREATE INDEX channels_subscription_idx ON channels (is_subscribed, updated_at DESC);
CREATE INDEX channels_trial_idx ON channels (trial_status, updated_at DESC);

ALTER TABLE videos
  ADD COLUMN watch_state text NOT NULL DEFAULT 'unwatched'
    CHECK (watch_state IN ('unwatched', 'in_progress', 'watched')),
  ADD COLUMN playback_position_seconds numeric(12, 3) NOT NULL DEFAULT 0
    CHECK (playback_position_seconds >= 0),
  ADD COLUMN playback_duration_seconds numeric(12, 3)
    CHECK (playback_duration_seconds IS NULL OR playback_duration_seconds >= 0),
  ADD COLUMN watch_percentage numeric(5, 4) NOT NULL DEFAULT 0
    CHECK (watch_percentage >= 0 AND watch_percentage <= 1),
  ADD COLUMN last_watched_at timestamptz,
  ADD COLUMN opened_count integer NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  ADD COLUMN last_opened_at timestamptz;

CREATE INDEX videos_home_idx ON videos (watch_state, upload_date DESC NULLS LAST);

CREATE TABLE feed_impressions (
  video_id text PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  impression_count integer NOT NULL DEFAULT 0 CHECK (impression_count >= 0),
  first_impressed_at timestamptz NOT NULL DEFAULT now(),
  last_impressed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE discovery_runs (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ready', 'failed')),
  requested_count integer NOT NULL DEFAULT 5 CHECK (requested_count > 0),
  model text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE discovery_candidates (
  id uuid PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_url text,
  reason text,
  status text NOT NULL CHECK (status IN ('proposed', 'duplicate', 'invalid', 'accepted')),
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discovery_candidates_url_idx ON discovery_candidates (source_url);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_type_check
  CHECK (type IN ('import_channel', 'download_video', 'discover_channels'));
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_check;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_target_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_target_check CHECK (
  (type = 'import_channel' AND channel_id IS NOT NULL AND video_id IS NULL)
  OR (type = 'download_video' AND video_id IS NOT NULL)
  OR (type = 'discover_channels' AND channel_id IS NULL AND video_id IS NULL)
);

CREATE UNIQUE INDEX jobs_active_discovery_idx ON jobs (type)
  WHERE type = 'discover_channels' AND status IN ('queued', 'running');

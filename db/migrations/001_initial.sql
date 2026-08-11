CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL UNIQUE,
  name text NOT NULL,
  handle text,
  description text,
  thumbnail_url text,
  source text NOT NULL DEFAULT 'initial_seed' CHECK (source IN ('user_added', 'initial_seed', 'ai_recommendation', 'podcast')),
  source_before_podcast text CHECK (source_before_podcast IS NULL OR source_before_podcast IN ('user_added', 'initial_seed', 'ai_recommendation')),
  is_subscribed boolean NOT NULL DEFAULT false,
  is_retained boolean NOT NULL DEFAULT false,
  is_pruned boolean NOT NULL DEFAULT false,
  is_podcast boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  videos_presented integer NOT NULL DEFAULT 0 CHECK (videos_presented >= 0),
  videos_opened integer NOT NULL DEFAULT 0 CHECK (videos_opened >= 0),
  videos_watched integer NOT NULL DEFAULT 0 CHECK (videos_watched >= 0),
  average_percentage_watched numeric(5,4) NOT NULL DEFAULT 0 CHECK (average_percentage_watched >= 0 AND average_percentage_watched <= 1),
  recent_engagement numeric(5,4) NOT NULL DEFAULT 0 CHECK (recent_engagement >= 0 AND recent_engagement <= 1),
  last_interaction_at timestamptz,
  rejection_count integer NOT NULL DEFAULT 0 CHECK (rejection_count >= 0),
  last_rejection_reason text,
  last_ai_justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channels_recommendation_idx ON channels (is_pruned, is_podcast, is_retained, recent_engagement DESC);

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL UNIQUE,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  view_count bigint,
  watch_state text NOT NULL DEFAULT 'unwatched' CHECK (watch_state IN ('unwatched', 'in_progress', 'watched')),
  progress_seconds numeric(12,3) NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  watch_percentage numeric(5,4) NOT NULL DEFAULT 0 CHECK (watch_percentage >= 0 AND watch_percentage <= 1),
  watched_at timestamptz,
  last_interaction_at timestamptz,
  is_trial boolean NOT NULL DEFAULT false,
  is_ignored boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  recommendation_score numeric(12,6) NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS videos_channel_catalog_idx ON videos (channel_id, published_at DESC NULLS LAST, view_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS videos_watch_feed_idx ON videos (watch_state, is_ignored, recommendation_score DESC);

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  path text NOT NULL,
  bytes bigint NOT NULL DEFAULT 0 CHECK (bytes >= 0 AND bytes <= 137438953472),
  height integer NOT NULL DEFAULT 0 CHECK (height >= 0 AND height <= 720),
  mime_type text NOT NULL DEFAULT 'video/mp4',
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'downloading', 'ready', 'failed', 'unavailable', 'deleted')),
  error_message text,
  downloaded_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_ready_idx ON media_files (state, last_accessed_at);

CREATE TABLE IF NOT EXISTS download_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('auto', 'manual', 'podcast')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'downloading', 'ready', 'failed', 'unavailable')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS download_jobs_active_video_unique ON download_jobs (video_id) WHERE status IN ('queued', 'downloading');
CREATE INDEX IF NOT EXISTS download_jobs_queue_idx ON download_jobs (status, requested_at);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('preference', 'trial', 'recent', 'diversity', 'podcast')),
  score numeric(12,6) NOT NULL DEFAULT 0,
  position integer,
  reason text,
  active boolean NOT NULL DEFAULT true,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recommendations_active_idx ON recommendations (active, position);

CREATE TABLE IF NOT EXISTS ai_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'completed', 'failed')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposals jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS channel_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  discovery_id uuid REFERENCES ai_discoveries(id) ON DELETE SET NULL,
  justification text,
  outcome text NOT NULL CHECK (outcome IN ('candidate', 'trial', 'promoted', 'pruned', 'rejected')),
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_evaluations_history_idx ON channel_evaluations (channel_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('presented', 'opened', 'progress', 'watched', 'manual')),
  position_seconds numeric(12,3) NOT NULL DEFAULT 0,
  watch_percentage numeric(5,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watch_events_video_idx ON watch_events (video_id, created_at DESC);


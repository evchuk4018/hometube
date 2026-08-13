CREATE TABLE channels (
  id uuid PRIMARY KEY,
  youtube_channel_id text UNIQUE,
  source_url text NOT NULL UNIQUE,
  name text NOT NULL,
  handle text,
  thumbnail_url text,
  import_status text NOT NULL DEFAULT 'queued' CHECK (import_status IN ('queued', 'importing', 'ready', 'failed')),
  import_error text,
  last_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE videos (
  id text PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  upload_date date,
  view_count bigint CHECK (view_count IS NULL OR view_count >= 0),
  thumbnail_url text,
  web_url text NOT NULL,
  availability text NOT NULL DEFAULT 'public',
  live_status text,
  media_status text NOT NULL DEFAULT 'not_downloaded' CHECK (media_status IN ('not_downloaded', 'queued', 'downloading', 'ready', 'failed')),
  media_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX videos_channel_upload_idx ON videos (channel_id, upload_date DESC NULLS LAST, created_at DESC);

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('import_channel', 'download_video')),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  video_id text REFERENCES videos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'ready', 'failed')),
  progress numeric(5, 2) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage text NOT NULL DEFAULT 'Queued',
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    (type = 'import_channel' AND channel_id IS NOT NULL AND video_id IS NULL)
    OR (type = 'download_video' AND video_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX jobs_active_channel_idx ON jobs (channel_id)
  WHERE type = 'import_channel' AND status IN ('queued', 'running');
CREATE UNIQUE INDEX jobs_active_video_idx ON jobs (video_id)
  WHERE type = 'download_video' AND status IN ('queued', 'running');
CREATE INDEX jobs_claim_idx ON jobs (status, created_at);

CREATE TABLE media_files (
  video_id text PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  relative_path text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  content_type text NOT NULL DEFAULT 'video/mp4',
  width integer,
  height integer,
  video_codec text,
  audio_codec text,
  created_at timestamptz NOT NULL DEFAULT now()
);


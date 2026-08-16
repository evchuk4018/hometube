CREATE TABLE feed_refresh_penalties (
  video_id text PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  penalty numeric(5, 3) NOT NULL DEFAULT 0 CHECK (penalty >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

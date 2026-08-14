CREATE TABLE playback_sessions (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  video_id text REFERENCES videos(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

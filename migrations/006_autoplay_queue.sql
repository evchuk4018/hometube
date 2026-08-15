CREATE TABLE autoplay_queues (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  video_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

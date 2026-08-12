ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS preference_bias smallint NOT NULL DEFAULT 0
    CHECK (preference_bias BETWEEN -1 AND 1);

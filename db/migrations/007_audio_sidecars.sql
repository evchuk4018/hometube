ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_bytes bigint NOT NULL DEFAULT 0;

ALTER TABLE media_files
  DROP CONSTRAINT IF EXISTS media_files_audio_bytes_check;

ALTER TABLE media_files
  ADD CONSTRAINT media_files_audio_bytes_check
  CHECK (audio_bytes >= 0 AND audio_bytes <= 137438953472);

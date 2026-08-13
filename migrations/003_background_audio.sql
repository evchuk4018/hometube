ALTER TABLE media_files
  ADD COLUMN audio_relative_path text UNIQUE,
  ADD COLUMN audio_size_bytes bigint CHECK (audio_size_bytes IS NULL OR audio_size_bytes >= 0),
  ADD COLUMN audio_content_type text,
  ADD CONSTRAINT media_files_audio_asset_complete CHECK (
    (audio_relative_path IS NULL AND audio_size_bytes IS NULL AND audio_content_type IS NULL)
    OR
    (audio_relative_path IS NOT NULL AND audio_size_bytes IS NOT NULL AND audio_content_type IS NOT NULL)
  );

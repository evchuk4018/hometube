ALTER TABLE autoplay_queues
ADD COLUMN excluded_channel_ids uuid[] NOT NULL DEFAULT '{}';

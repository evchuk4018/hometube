-- Retain catalogs and provenance while removing unsubscribed AI trials from recommendations.
UPDATE channels
SET trial_status = 'dismissed',
  evaluated_at = COALESCE(evaluated_at, now()),
  updated_at = now()
WHERE source = 'ai_recommendation' AND is_subscribed = false AND trial_status = 'active';

UPDATE jobs
SET status = 'failed',
  stage = 'Discovery disabled',
  error = 'AI channel discovery has been disabled.',
  lease_owner = NULL,
  lease_expires_at = NULL,
  completed_at = now(),
  updated_at = now()
WHERE type = 'discover_channels' AND status IN ('queued', 'running');

UPDATE discovery_runs
SET status = 'failed',
  error = 'AI channel discovery has been disabled.',
  completed_at = now()
WHERE status = 'running';

-- Preserve the current video regardless of subscription, original order, and session exclusions.
UPDATE autoplay_queues AS queue
SET video_ids = ARRAY(
  SELECT entry.video_id
  FROM unnest(queue.video_ids) WITH ORDINALITY AS entry(video_id, position)
  JOIN videos v ON v.id = entry.video_id
  JOIN channels c ON c.id = v.channel_id
  WHERE c.is_subscribed = true
    OR entry.video_id = (SELECT video_id FROM playback_sessions WHERE id = 1)
  ORDER BY entry.position
), updated_at = now();

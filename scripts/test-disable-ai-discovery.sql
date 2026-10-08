-- Run with psql -X -v ON_ERROR_STOP=1 -f scripts/test-disable-ai-discovery.sql on a disposable database.
-- All fixture tables and data live in a separate schema and are rolled back after verification.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA hometube_ai_cleanup_test;
SET LOCAL search_path = hometube_ai_cleanup_test;

\ir ../migrations/001_initial.sql
\ir ../migrations/002_clear_search_cache.sql
\ir ../migrations/003_background_audio.sql
\ir ../migrations/004_home_feed.sql
\ir ../migrations/005_playback_session.sql
\ir ../migrations/006_autoplay_queue.sql
\ir ../migrations/007_feed_refresh_penalty.sql
\ir ../migrations/008_autoplay_queue_exclusions.sql

INSERT INTO channels (id, source_url, name, source, is_subscribed, trial_status, discovery_reason, evaluated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'https://www.youtube.com/@subscribed', 'Subscribed', 'user_added', true, 'none', NULL, NULL),
  ('00000000-0000-4000-8000-000000000002', 'https://www.youtube.com/@trial', 'Active AI trial', 'ai_recommendation', false, 'active', 'Historical discovery reason', NULL),
  ('00000000-0000-4000-8000-000000000003', 'https://www.youtube.com/@subscribed-ai', 'Subscribed AI', 'ai_recommendation', true, 'active', 'Keep this provenance', NULL),
  ('00000000-0000-4000-8000-000000000004', 'https://www.youtube.com/@evaluated', 'Evaluated AI', 'ai_recommendation', false, 'evaluated', 'Past evaluation', '2026-01-02T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', 'https://www.youtube.com/@unsubscribed-manual', 'Unsubscribed manual', 'user_added', false, 'none', NULL, NULL),
  ('00000000-0000-4000-8000-000000000006', 'https://www.youtube.com/@current', 'Current AI trial', 'ai_recommendation', false, 'active', 'Playing trial', NULL);

INSERT INTO videos (id, channel_id, title, web_url, media_status, watch_state, playback_position_seconds, watch_percentage)
VALUES
  ('sub-one', '00000000-0000-4000-8000-000000000001', 'Subscribed video', 'https://www.youtube.com/watch?v=sub-one', 'not_downloaded', 'unwatched', 0, 0),
  ('ai-upcoming', '00000000-0000-4000-8000-000000000002', 'Upcoming trial', 'https://www.youtube.com/watch?v=ai-upcoming', 'queued', 'unwatched', 0, 0),
  ('ai-subscribed', '00000000-0000-4000-8000-000000000003', 'Subscribed AI', 'https://www.youtube.com/watch?v=ai-subscribed', 'ready', 'unwatched', 0, 0),
  ('ai-history', '00000000-0000-4000-8000-000000000004', 'Watched trial', 'https://www.youtube.com/watch?v=ai-history', 'ready', 'watched', 100, 1),
  ('unsub-manual', '00000000-0000-4000-8000-000000000005', 'Manual video', 'https://www.youtube.com/watch?v=unsub-manual', 'not_downloaded', 'unwatched', 0, 0),
  ('current', '00000000-0000-4000-8000-000000000006', 'Current video', 'https://www.youtube.com/watch?v=current', 'ready', 'in_progress', 12, 0.6);

INSERT INTO media_files (video_id, relative_path, size_bytes) VALUES
  ('current', 'current/video.mp4', 1000), ('ai-history', 'ai-history/video.mp4', 2000);
INSERT INTO feed_impressions (video_id, impression_count) VALUES ('ai-history', 3);
INSERT INTO feed_refresh_penalties (video_id, penalty) VALUES ('sub-one', 0.25);
INSERT INTO playback_sessions (id, video_id) VALUES (1, 'current');
INSERT INTO autoplay_queues (id, video_ids, excluded_channel_ids) VALUES
  (1, ARRAY['sub-one', 'current', 'ai-upcoming', 'ai-subscribed', 'unsub-manual', 'missing-video'],
    ARRAY['00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002']::uuid[]);

INSERT INTO jobs (id, type, status, channel_id, video_id, lease_owner, lease_expires_at, completed_at, error)
VALUES
  ('00000000-0000-4000-8000-000000000201', 'discover_channels', 'queued', NULL, NULL, 'old-worker', now() + interval '5 minutes', NULL, NULL),
  ('00000000-0000-4000-8000-000000000202', 'discover_channels', 'ready', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z', NULL),
  ('00000000-0000-4000-8000-000000000203', 'discover_channels', 'failed', NULL, NULL, NULL, NULL, '2026-01-02T00:00:00Z', 'Original failure'),
  ('00000000-0000-4000-8000-000000000204', 'import_channel', 'queued', '00000000-0000-4000-8000-000000000002', NULL, NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-000000000205', 'download_video', 'queued', '00000000-0000-4000-8000-000000000006', 'current', NULL, NULL, NULL, NULL);

INSERT INTO discovery_runs (id, status, completed_at, error) VALUES
  ('00000000-0000-4000-8000-000000000301', 'running', NULL, NULL),
  ('00000000-0000-4000-8000-000000000302', 'ready', '2026-01-01T00:00:00Z', NULL),
  ('00000000-0000-4000-8000-000000000303', 'failed', '2026-01-02T00:00:00Z', 'Original failure');
INSERT INTO discovery_candidates (id, run_id, name, source_url, reason, status, channel_id) VALUES
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', 'Trial',
    'https://www.youtube.com/@trial', 'Historical candidate reason', 'accepted', '00000000-0000-4000-8000-000000000002');

CREATE TEMP TABLE original_catalog AS SELECT * FROM videos;
CREATE TEMP TABLE original_media AS SELECT * FROM media_files;
CREATE TEMP TABLE original_channels AS SELECT * FROM channels
  WHERE source <> 'ai_recommendation' OR is_subscribed OR trial_status <> 'active';
CREATE TEMP TABLE original_provenance AS SELECT id, source, source_url, discovery_reason FROM channels;
CREATE TEMP TABLE original_jobs AS SELECT * FROM jobs
  WHERE type <> 'discover_channels' OR status NOT IN ('queued', 'running');
CREATE TEMP TABLE original_runs AS SELECT * FROM discovery_runs WHERE status <> 'running';
CREATE TEMP TABLE original_candidates AS SELECT * FROM discovery_candidates;
CREATE TEMP TABLE original_playback AS SELECT * FROM playback_sessions;
CREATE TEMP TABLE original_impressions AS SELECT * FROM feed_impressions;
CREATE TEMP TABLE original_penalties AS SELECT * FROM feed_refresh_penalties;

\ir ../migrations/009_disable_ai_discovery.sql

DO $$
BEGIN
  IF (SELECT video_ids FROM autoplay_queues WHERE id = 1) IS DISTINCT FROM ARRAY['sub-one', 'current', 'ai-subscribed'] THEN
    RAISE EXCEPTION 'Queue pruning changed order, lost current playback, or retained an unsubscribed entry';
  END IF;
  IF (SELECT excluded_channel_ids FROM autoplay_queues WHERE id = 1) IS DISTINCT FROM
    ARRAY['00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002']::uuid[] THEN
    RAISE EXCEPTION 'Session channel exclusions changed';
  END IF;
  IF (SELECT count(*) FROM channels WHERE source = 'ai_recommendation' AND NOT is_subscribed AND trial_status = 'dismissed' AND evaluated_at IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Unsubscribed active trials were not dismissed';
  END IF;
  IF EXISTS (SELECT 1 FROM jobs WHERE type = 'discover_channels' AND status IN ('queued', 'running'))
    OR NOT EXISTS (SELECT 1 FROM jobs WHERE id = '00000000-0000-4000-8000-000000000201'
      AND status = 'failed' AND stage = 'Discovery disabled' AND error = 'AI channel discovery has been disabled.'
      AND lease_owner IS NULL AND lease_expires_at IS NULL AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Queued discovery was not retired with a reason, cleared lease, and completion timestamp';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM discovery_runs WHERE id = '00000000-0000-4000-8000-000000000301'
    AND status = 'failed' AND error = 'AI channel discovery has been disabled.' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Running discovery was not retired';
  END IF;
  IF EXISTS ((TABLE videos EXCEPT TABLE original_catalog) UNION ALL (TABLE original_catalog EXCEPT TABLE videos))
    OR EXISTS ((TABLE media_files EXCEPT TABLE original_media) UNION ALL (TABLE original_media EXCEPT TABLE media_files)) THEN
    RAISE EXCEPTION 'Catalog, watch history, or media changed';
  END IF;
  IF EXISTS (TABLE original_channels EXCEPT TABLE channels)
    OR EXISTS ((SELECT id, source, source_url, discovery_reason FROM channels EXCEPT TABLE original_provenance)
      UNION ALL (TABLE original_provenance EXCEPT SELECT id, source, source_url, discovery_reason FROM channels)) THEN
    RAISE EXCEPTION 'Subscriptions, historical evaluations, or provenance changed';
  END IF;
  IF EXISTS (TABLE original_jobs EXCEPT TABLE jobs) OR EXISTS (TABLE original_runs EXCEPT TABLE discovery_runs)
    OR EXISTS ((TABLE discovery_candidates EXCEPT TABLE original_candidates) UNION ALL (TABLE original_candidates EXCEPT TABLE discovery_candidates)) THEN
    RAISE EXCEPTION 'Completed discovery history, manual imports, downloads, or candidates changed';
  END IF;
  IF EXISTS ((TABLE playback_sessions EXCEPT TABLE original_playback) UNION ALL (TABLE original_playback EXCEPT TABLE playback_sessions))
    OR EXISTS ((TABLE feed_impressions EXCEPT TABLE original_impressions) UNION ALL (TABLE original_impressions EXCEPT TABLE feed_impressions))
    OR EXISTS ((TABLE feed_refresh_penalties EXCEPT TABLE original_penalties) UNION ALL (TABLE original_penalties EXCEPT TABLE feed_refresh_penalties)) THEN
    RAISE EXCEPTION 'Playback, impressions, or feed penalties changed';
  END IF;
END $$;

-- Cover a leased running job, no current playback, and safe repeat application.
INSERT INTO jobs (id, type, status, lease_owner, lease_expires_at) VALUES
  ('00000000-0000-4000-8000-000000000206', 'discover_channels', 'running', 'old-worker', now() + interval '5 minutes');
DELETE FROM playback_sessions;
UPDATE autoplay_queues SET video_ids = ARRAY['current', 'unsub-manual', 'ai-subscribed'];
\ir ../migrations/009_disable_ai_discovery.sql

DO $$
BEGIN
  IF (SELECT video_ids FROM autoplay_queues WHERE id = 1) IS DISTINCT FROM ARRAY['ai-subscribed'] THEN
    RAISE EXCEPTION 'Unsubscribed stale queue head survived without current playback';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE id = '00000000-0000-4000-8000-000000000206'
    AND status = 'failed' AND lease_owner IS NULL AND lease_expires_at IS NULL AND completed_at IS NOT NULL
    AND error = 'AI channel discovery has been disabled.') THEN
    RAISE EXCEPTION 'Running discovery job retained its lease or was not completed';
  END IF;
  IF (SELECT excluded_channel_ids FROM autoplay_queues WHERE id = 1) IS DISTINCT FROM
    ARRAY['00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002']::uuid[] THEN
    RAISE EXCEPTION 'Repeat cleanup changed session exclusions';
  END IF;
END $$;

\ir ../migrations/009_disable_ai_discovery.sql
DO $$
BEGIN
  IF (SELECT video_ids FROM autoplay_queues WHERE id = 1) IS DISTINCT FROM ARRAY['ai-subscribed']
    OR EXISTS (TABLE original_jobs EXCEPT TABLE jobs) THEN
    RAISE EXCEPTION 'Repeat migration changed the queue or historical jobs';
  END IF;
END $$;
ROLLBACK;
\echo 'AI discovery cleanup migration fixtures passed.'

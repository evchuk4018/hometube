import { query, transaction } from '@/server/db/client';
import { playbackState, REFRESH_PENALTY, selectRankedFeed, type RankingCandidate } from '@/domain/feed-ranking';
import { shouldClearCurrentPlaybackSession } from '@/domain/playback-session';
import type { VideoSummary } from '@/protocol/schemas';
import { mapVideo, type VideoRow } from '@/server/channels/channel-repository';
import { clearCurrentVideoIfMatching, setCurrentVideo } from '@/server/playback/playback-session-repository';

type FeedRow = VideoRow & {
  is_subscribed: boolean;
  trial_status: string;
  channel_view_max: string;
  channel_weighted_watch: string;
  channel_evidence: string;
  refresh_penalty: string;
};

export async function listRankedFeed(limit = 40): Promise<VideoSummary[]> {
  const rows = await listRankedFeedRows();
  const ids = selectRankedFeed(rankingCandidates(rows), limit);
  const byId = videoSummaries(rows);
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function listRankedFeedRows(): Promise<FeedRow[]> {
  return query<FeedRow>(`
    WITH channel_stats AS (
      SELECT c.id,
        COALESCE(sum(
          v.watch_percentage * power(0.5, extract(epoch FROM (now() - COALESCE(v.last_watched_at, v.last_opened_at, fi.last_impressed_at))) / 2592000)
        ) FILTER (WHERE v.last_watched_at IS NOT NULL OR v.last_opened_at IS NOT NULL OR fi.video_id IS NOT NULL), 0) AS weighted_watch,
        COALESCE(sum(
          GREATEST(
            COALESCE(fi.impression_count, 0),
            CASE WHEN v.last_watched_at IS NOT NULL OR v.last_opened_at IS NOT NULL THEN 1 ELSE 0 END
          ) * power(0.5, extract(epoch FROM (now() - COALESCE(v.last_watched_at, v.last_opened_at, fi.last_impressed_at))) / 2592000)
        ) FILTER (WHERE v.last_watched_at IS NOT NULL OR v.last_opened_at IS NOT NULL OR fi.video_id IS NOT NULL), 0) AS evidence
      FROM channels c
      LEFT JOIN videos v ON v.channel_id = c.id
      LEFT JOIN feed_impressions fi ON fi.video_id = v.id
      GROUP BY c.id
    ), candidates AS (
      SELECT v.id, v.channel_id, c.name AS channel_name, v.title, v.duration_seconds,
        v.upload_date::text, v.view_count::text, v.thumbnail_url, v.web_url,
        v.availability, v.live_status, v.media_status, v.media_error,
        (m.audio_relative_path IS NOT NULL) AS has_background_audio,
        v.watch_state, v.playback_position_seconds::text,
        v.playback_duration_seconds::text, v.watch_percentage::text,
        c.is_subscribed, c.trial_status,
        COALESCE(max(v.view_count) OVER (PARTITION BY v.channel_id), 0)::text AS channel_view_max,
        cs.weighted_watch::text AS channel_weighted_watch,
        cs.evidence::text AS channel_evidence,
        COALESCE(fp.penalty * power(0.5, extract(epoch FROM (now() - fp.updated_at)) / 2592000), 0)::text AS refresh_penalty
      FROM videos v
      JOIN channels c ON c.id = v.channel_id
      JOIN channel_stats cs ON cs.id = c.id
      LEFT JOIN media_files m ON m.video_id = v.id
      LEFT JOIN feed_refresh_penalties fp ON fp.video_id = v.id
      WHERE v.watch_state <> 'watched'
        AND (c.is_subscribed = true OR c.trial_status = 'active')
        AND v.availability NOT IN ('private', 'premium_only', 'subscriber_only', 'unavailable')
        AND COALESCE(v.live_status, '') NOT IN ('is_live', 'is_upcoming')
    )
    SELECT * FROM candidates
  `);
}

export function rankingCandidates(rows: FeedRow[]): RankingCandidate[] {
  return rows.map((row) => ({
    videoId: row.id,
    channelId: row.channel_id,
    trial: !row.is_subscribed && row.trial_status === 'active',
    subscribed: row.is_subscribed,
    watchState: row.watch_state,
    watchPercentage: row.watch_percentage === null ? null : Number(row.watch_percentage),
    uploadDate: row.upload_date,
    viewCount: row.view_count === null ? null : Number(row.view_count),
    channelViewMax: Number(row.channel_view_max),
    channelWeightedWatch: Number(row.channel_weighted_watch),
    channelEvidence: Number(row.channel_evidence),
    refreshPenalty: Number(row.refresh_penalty)
  }));
}

export function videoSummaries(rows: FeedRow[]): Map<string, VideoSummary> {
  return new Map(rows.map((row) => [row.id, mapVideo(row)]));
}

export async function recordFeedImpressions(videoIds: string[]): Promise<void> {
  await query(`
    INSERT INTO feed_impressions (video_id, impression_count)
    SELECT id, 1 FROM videos WHERE id = ANY($1::text[])
    ON CONFLICT (video_id) DO UPDATE SET
      impression_count = feed_impressions.impression_count + 1,
      last_impressed_at = now()
  `, [videoIds]);
}

export async function applyFeedRefreshPenalties(videoIds: string[]): Promise<void> {
  await query(`
    INSERT INTO feed_refresh_penalties (video_id, penalty)
    SELECT id, $2 FROM videos WHERE id = ANY($1::text[])
    ON CONFLICT (video_id) DO UPDATE SET
      penalty = feed_refresh_penalties.penalty + EXCLUDED.penalty,
      updated_at = now()
  `, [videoIds, REFRESH_PENALTY]);
}

export async function recordVideoOpen(videoId: string): Promise<boolean> {
  return transaction(async (client) => {
    const rows = await client.query<{ id: string }>(`
      UPDATE videos SET opened_count = opened_count + 1, last_opened_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING id
    `, [videoId]);
    if (!rows.rows[0]) return false;
    await setCurrentVideo(client, videoId);
    return true;
  });
}

export async function savePlaybackProgress(videoId: string, positionSeconds: number, durationSeconds: number): Promise<VideoSummary['watchState'] | null> {
  const next = playbackState(positionSeconds, durationSeconds);
  return transaction(async (client) => {
    const rows = await client.query<{ watch_state: VideoSummary['watchState'] }>(`
        UPDATE videos SET
          playback_position_seconds = CASE WHEN $4 = 'watched' THEN 0::numeric ELSE $2 END,
          playback_duration_seconds = $3,
          watch_percentage = GREATEST(watch_percentage, $5),
          watch_state = CASE WHEN watch_state = 'watched' THEN 'watched' ELSE $4 END,
          last_watched_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING watch_state
      `, [videoId, positionSeconds, durationSeconds, next.state, next.percentage]);
    const watchState = rows.rows[0]?.watch_state ?? null;
    if (watchState && shouldClearCurrentPlaybackSession(watchState)) {
      await clearCurrentVideoIfMatching(client, videoId);
    }
    return watchState;
  });
}

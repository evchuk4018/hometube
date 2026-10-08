import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { queueDismissRequestSchema, type JobSummary, type QueueEntry, type VideoSummary } from '../../protocol/schemas';
import { ConflictError, NotFoundError } from '../protocol/http';
import { createQueueService } from './queue-service-core';
import type { PersistedQueue } from './queue-repository';

const repositorySource = fs.readFileSync(new URL('./queue-repository.ts', import.meta.url), 'utf8');
const dismissRouteSource = fs.readFileSync(new URL('../../app/api/queue/dismiss/route.ts', import.meta.url), 'utf8');
const exclusionsMigration = fs.readFileSync(new URL('../../../migrations/008_autoplay_queue_exclusions.sql', import.meta.url), 'utf8');

function video(id: string, channelId = id, overrides: Partial<VideoSummary> = {}): VideoSummary {
  return {
    id, channelId, channelName: channelId, title: id, durationSeconds: 120,
    uploadDate: '2026-10-08', viewCount: 100, thumbnailUrl: null,
    webUrl: `https://www.youtube.com/watch?v=${id}`, availability: 'public', liveStatus: null,
    mediaStatus: 'ready', mediaError: null, hasBackgroundAudio: false, downloadable: true,
    watchState: 'unwatched', playbackPositionSeconds: 0, playbackDurationSeconds: null, watchPercentage: 0,
    ...overrides
  };
}

function fixture(options: {
  queue: string[];
  videos: VideoSummary[];
  subscribed: string[];
  candidates?: string[];
  currentVideoId?: string | null;
  excluded?: string[];
  jobs?: Array<{ videoId: string; job: JobSummary }>;
}) {
  const catalog = new Map(options.videos.map((item) => [item.id, item]));
  const state: PersistedQueue = {
    videoIds: [...options.queue], excludedChannelIds: [...(options.excluded ?? [])],
    currentVideoId: options.currentVideoId ?? null
  };
  const stored: Array<{ videoIds: string[]; excludedChannelIds: string[] }> = [];
  const downloads: string[] = [];
  const jobReads: string[][] = [];
  const service = createQueueService({
    getQueueState: async () => ({ ...state, videoIds: [...state.videoIds], excludedChannelIds: [...state.excludedChannelIds] }),
    getSubscribedChannelIds: async (channelIds) => new Set(options.subscribed.filter((id) => channelIds.includes(id))),
    replaceQueue: async (videoIds, excludedChannelIds) => {
      state.videoIds = [...videoIds];
      state.excludedChannelIds = [...excludedChannelIds];
      stored.push({ videoIds: [...videoIds], excludedChannelIds: [...excludedChannelIds] });
    },
    getVideo: async (id) => catalog.get(id) ?? null,
    getActiveVideoDownloadJobs: async (ids) => {
      jobReads.push([...ids]);
      return (options.jobs ?? []).filter((entry) => ids.includes(entry.videoId));
    },
    enqueueVideoDownload: async (id) => { downloads.push(id); },
    loadRankedCandidates: async () => (options.candidates ?? []).flatMap((id) => {
      const candidate = catalog.get(id);
      return candidate ? [{ videoId: candidate.id, channelId: candidate.channelId, watchState: candidate.watchState }] : [];
    })
  });
  return { service, state, stored, downloads, jobReads };
}

function ids(entries: QueueEntry[]): string[] {
  return entries.map((entry) => entry.video.id);
}

test('the dismiss request requires both the current and dismissed video ids', () => {
  assert.equal(queueDismissRequestSchema.safeParse({ currentVideoId: 'a' }).success, false);
  assert.equal(queueDismissRequestSchema.safeParse({ videoId: 'b' }).success, false);
  assert.equal(queueDismissRequestSchema.safeParse({ currentVideoId: 'a', videoId: '' }).success, false);
  assert.deepEqual(queueDismissRequestSchema.parse({ currentVideoId: 'a', videoId: 'b' }), { currentVideoId: 'a', videoId: 'b' });
});

test('the dismiss route validates input and delegates to the queue service', () => {
  assert.match(dismissRouteSource, /queueDismissRequestSchema\.parse/);
  assert.match(dismissRouteSource, /dismissQueueEntry\(currentVideoId, videoId\)/);
});

test('the repository avoids duplicate excluded channel ids', () => {
  assert.match(repositorySource, /new Set\(excludedChannelIds\)/);
});

test('saved eligibility queries use subscription status and preserve the raw playback session video', () => {
  assert.match(repositorySource, /WHERE id = ANY\(\$1::uuid\[\]\) AND is_subscribed = true/);
  assert.match(repositorySource, /SELECT video_id FROM playback_sessions WHERE id = 1/);
  assert.doesNotMatch(repositorySource, /source =|watch_state/);
});

test('GET removes unsubscribed entries but retains actual current playback and subscribed AI provenance', async () => {
  const job: JobSummary = { id: 'job-current', type: 'download_video', status: 'running', progress: 10, stage: 'Downloading', error: null };
  const f = fixture({
    queue: ['stale-head', 'playing', 'subscribed-ai', 'unsubscribed-next'],
    videos: [video('stale-head', 'trial'), video('playing', 'trial'), video('subscribed-ai', 'subscribed-ai'), video('unsubscribed-next', 'trial')],
    subscribed: ['subscribed-ai'], currentVideoId: 'playing', excluded: ['excluded'],
    jobs: [{ videoId: 'playing', job }]
  });
  const entries = await f.service.getQueue();
  assert.deepEqual(ids(entries), ['playing', 'subscribed-ai']);
  assert.deepEqual(entries[0].job, job);
  assert.deepEqual(f.jobReads, [['playing', 'subscribed-ai']]);
  assert.deepEqual(f.stored, []);
  assert.deepEqual(f.downloads, []);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded']);
});

test('GET removes an unsubscribed head without a current session and handles missing videos', async () => {
  const f = fixture({ queue: ['trial', 'deleted', 'subscribed'], videos: [video('trial'), video('subscribed')], subscribed: ['subscribed'] });
  assert.deepEqual(ids(await f.service.getQueue()), ['subscribed']);
  assert.deepEqual(f.stored, []);
});

test('rebuilding keeps unsubscribed current playback, filters the saved tail, and preserves session exclusions', async () => {
  const f = fixture({
    queue: ['old', 'current', 'trial', 'keep'],
    videos: [video('old'), video('current', 'trial', { mediaStatus: 'not_downloaded' }), video('trial'), video('keep'),
      video('excluded'), video('fill', 'fill', { mediaStatus: 'not_downloaded' })],
    subscribed: ['old', 'keep', 'excluded', 'fill'], candidates: ['excluded', 'fill'], excluded: ['excluded'], currentVideoId: 'old'
  });
  assert.deepEqual(ids(await f.service.buildAndStoreQueue('current')), ['current', 'keep', 'fill']);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded']);
  assert.deepEqual(f.downloads, ['current', 'fill']);
});

test('starting direct playback outside the old queue clears session exclusions and still allows unsubscribed current playback', async () => {
  const f = fixture({
    queue: ['old'], videos: [video('old'), video('new', 'trial'), video('previously-excluded')],
    subscribed: ['old', 'previously-excluded'], candidates: ['previously-excluded'], excluded: ['previously-excluded']
  });
  assert.deepEqual(ids(await f.service.buildAndStoreQueue('new')), ['new', 'previously-excluded']);
  assert.deepEqual(f.state.excludedChannelIds, []);
});

test('dismissal prunes unsubscribed entries, excludes the dismissed channel, and refills only eligible channels', async () => {
  const f = fixture({
    queue: ['current', 'dismiss', 'trial'],
    videos: [video('current', 'trial'), video('dismiss', 'dismiss-channel'), video('trial'),
      video('excluded'), video('dismiss-sibling', 'dismiss-channel'), video('fill-a'), video('fill-b')],
    subscribed: ['dismiss-channel', 'excluded', 'fill-a', 'fill-b'],
    candidates: ['excluded', 'dismiss-sibling', 'fill-a', 'fill-b'], excluded: ['excluded']
  });
  assert.deepEqual(ids(await f.service.dismissQueueEntry('current', 'dismiss')), ['current', 'fill-a', 'fill-b']);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded', 'dismiss-channel']);
  assert.deepEqual(f.state.videoIds, ['current', 'fill-a', 'fill-b']);
});

test('a stale dismissal of an unsubscribed entry cleans the queue without adding an exclusion', async () => {
  const f = fixture({
    queue: ['current', 'trial', 'keep'], videos: [video('current', 'trial'), video('trial'), video('keep'), video('fill')],
    subscribed: ['keep', 'fill'], candidates: ['fill'], excluded: ['excluded']
  });
  assert.deepEqual(ids(await f.service.dismissQueueEntry('current', 'trial')), ['current', 'keep']);
  assert.deepEqual(f.state.videoIds, ['current', 'keep']);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded']);
});

test('dismissing an absent video returns an eligible stored queue unchanged', async () => {
  const f = fixture({ queue: ['current', 'keep'], videos: [video('current'), video('keep')], subscribed: ['current', 'keep'], excluded: ['excluded'] });
  assert.deepEqual(ids(await f.service.dismissQueueEntry('current', 'missing')), ['current', 'keep']);
  assert.deepEqual(f.stored, []);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded']);
});

test('dismissal after advancing to an unsubscribed queued video preserves session exclusions', async () => {
  const f = fixture({
    queue: ['old', 'current', 'dismiss'],
    videos: [video('old'), video('current', 'trial'), video('dismiss'), video('excluded'), video('fill')],
    subscribed: ['old', 'dismiss', 'excluded', 'fill'], candidates: ['excluded', 'fill'], excluded: ['excluded']
  });
  assert.deepEqual(ids(await f.service.dismissQueueEntry('current', 'dismiss')), ['current', 'fill']);
  assert.deepEqual(f.state.excludedChannelIds, ['excluded', 'dismiss']);
});

test('the current video cannot be dismissed and an unrelated current video cannot hijack the active queue', async () => {
  const f = fixture({ queue: ['current', 'keep'], videos: [video('current'), video('keep'), video('unrelated')], subscribed: ['current', 'keep'] });
  await assert.rejects(f.service.dismissQueueEntry('current', 'current'), ConflictError);
  await assert.rejects(f.service.dismissQueueEntry('unrelated', 'keep'), ConflictError);
  await assert.rejects(f.service.buildAndStoreQueue('missing'), NotFoundError);
  assert.deepEqual(f.stored, []);
});

test('queue persistence leaves ready and unavailable media alone while downloading selected playable videos', async () => {
  const f = fixture({
    queue: [], videos: [video('current'), video('unavailable', 'unavailable', { downloadable: false, mediaStatus: 'not_downloaded' }),
      video('download', 'download', { mediaStatus: 'not_downloaded' })],
    subscribed: ['unavailable', 'download'], candidates: ['unavailable', 'download']
  });
  assert.deepEqual(ids(await f.service.buildAndStoreQueue('current')), ['current', 'unavailable', 'download']);
  assert.deepEqual(f.downloads, ['download']);
});

test('the exclusions migration extends the autoplay queue table with a safe default', () => {
  assert.match(exclusionsMigration, /ALTER TABLE autoplay_queues/);
  assert.match(exclusionsMigration, /excluded_channel_ids uuid\[\] NOT NULL DEFAULT '\{\}'/);
});

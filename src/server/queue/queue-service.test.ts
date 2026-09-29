import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { queueDismissRequestSchema } from '../../protocol/schemas';

const serviceSource = fs.readFileSync(new URL('./queue-service.ts', import.meta.url), 'utf8');
const repositorySource = fs.readFileSync(new URL('./queue-repository.ts', import.meta.url), 'utf8');
const dismissRouteSource = fs.readFileSync(new URL('../../app/api/queue/dismiss/route.ts', import.meta.url), 'utf8');
const exclusionsMigration = fs.readFileSync(new URL('../../../migrations/008_autoplay_queue_exclusions.sql', import.meta.url), 'utf8');

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

test('dismissing persists the queue together with its excluded channels', () => {
  assert.match(serviceSource, /dismissQueuedVideo\(/);
  assert.match(serviceSource, /storeQueue\(dismissal\.queue, new Set\(dismissal\.excludedChannelIds\)\)/);
  assert.match(repositorySource, /excluded_channel_ids/);
});

test('the repository avoids duplicate excluded channel ids', () => {
  assert.match(repositorySource, /new Set\(excludedChannelIds\)/);
});

test('the current video cannot be dismissed', () => {
  assert.match(serviceSource, /if \(videoId === currentVideoId\) throw new ConflictError/);
});

test('dismissing an entry that is no longer queued returns the stored queue unchanged', () => {
  assert.match(serviceSource, /if \(!dismissal\) return loadEntries\(synced\.videoIds\)/);
});

test('continuing a queue keeps exclusions while a new queue clears them', () => {
  assert.match(serviceSource, /queueSessionExcludedChannels\(current\.id, existing, state\.excludedChannelIds\)/);
});

test('dismissal leaves downloads and channel state alone', () => {
  assert.doesNotMatch(serviceSource, /trial_status|feed_refresh_penalties|cancel/i);
  assert.match(serviceSource, /ensureDownloads\(/);
});

test('the exclusions migration extends the autoplay queue table with a safe default', () => {
  assert.match(exclusionsMigration, /ALTER TABLE autoplay_queues/);
  assert.match(exclusionsMigration, /excluded_channel_ids uuid\[\] NOT NULL DEFAULT '\{\}'/);
});

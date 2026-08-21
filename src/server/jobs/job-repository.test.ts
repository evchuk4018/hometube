import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./job-repository.ts', import.meta.url), 'utf8');

test('getActiveChannelJob filters to active statuses', () => {
  assert.match(source, /getActiveChannelJob/);
  // Should filter status IN ('queued','running') to avoid returning stale ready/failed jobs
  assert.match(source, /status IN \('queued', 'running'\)/);
  assert.match(source, /WHERE channel_id = \$1 AND type = 'import_channel' AND status IN/);
});

test('claimNextJob handles null lease and does not starve queued jobs', () => {
  assert.match(source, /claimNextJob/);
  // Should handle lease_expires_at IS NULL
  assert.match(source, /lease_expires_at IS NULL OR lease_expires_at < now\(\)/);
  // Should allow queued with attempt_count <3 OR running with expired lease
  assert.match(source, /\(status = 'queued' AND attempt_count < 3\)/);
  assert.match(source, /\(status = 'running' AND \(lease_expires_at IS NULL OR lease_expires_at < now\(\)\)\)/);
});

test('enqueue functions reset expired running leases', () => {
  // Each enqueue should reset stale running to queued
  const enqueueMatches = source.match(/DO UPDATE SET[\s\S]*?status = CASE WHEN jobs\.status = 'running'/g) ?? [];
  assert.equal(enqueueMatches.length, 3, 'all three enqueue functions should handle stale lease reset');
  assert.match(source, /lease_expires_at IS NULL OR lease_expires_at < now\(\)/);
});

test('reapStuckJobs exists to handle orphaned queued jobs', () => {
  assert.match(source, /reapStuckJobs/);
  assert.match(source, /attempt_count >= 3/);
  assert.match(source, /media_status IN \('queued', 'downloading'\)/);
});

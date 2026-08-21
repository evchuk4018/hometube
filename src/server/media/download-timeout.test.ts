import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('download adapter uses timeouts to avoid hanging', () => {
  const source = fs.readFileSync(new URL('./download-adapter.ts', import.meta.url), 'utf8');
  assert.match(source, /timeoutMs: 10 \* 60 \* 1000/);
  assert.match(source, /timeoutMs: 8 \* 60 \* 1000/);
});

test('media probe and background audio use timeouts', () => {
  const probe = fs.readFileSync(new URL('./media-probe.ts', import.meta.url), 'utf8');
  assert.match(probe, /timeoutMs: 30_000/);
  const audio = fs.readFileSync(new URL('./background-audio.ts', import.meta.url), 'utf8');
  assert.match(audio, /timeoutMs: 5 \* 60 \* 1000/);
});

test('worker has per-job timeout and reap logic', () => {
  const worker = fs.readFileSync(new URL('../../worker/index.ts', import.meta.url), 'utf8');
  assert.match(worker, /reapStuckJobs/);
  assert.match(worker, /Job timed out after/);
  assert.match(worker, /download_video.*20 \* 60 \* 1000/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldClearCurrentPlaybackSession, shouldResumeCurrentPlaybackSession } from './playback-session';

test('clears the current session only after a video is watched', () => {
  assert.equal(shouldClearCurrentPlaybackSession('unwatched'), false);
  assert.equal(shouldClearCurrentPlaybackSession('in_progress'), false);
  assert.equal(shouldClearCurrentPlaybackSession('watched'), true);
});

test('resumes the current session on a cold start without a referer', () => {
  assert.equal(shouldResumeCurrentPlaybackSession(null, 'homelab.tail861ffd.ts.net'), true);
});

test('resumes the current session when arriving from another origin', () => {
  assert.equal(shouldResumeCurrentPlaybackSession('https://example.com/', 'homelab.tail861ffd.ts.net'), true);
});

test('does not resume for in-app navigation from the same host', () => {
  assert.equal(
    shouldResumeCurrentPlaybackSession('https://homelab.tail861ffd.ts.net/hometube/watch/abc', 'homelab.tail861ffd.ts.net'),
    false
  );
});

test('resumes the current session on a malformed referer', () => {
  assert.equal(shouldResumeCurrentPlaybackSession('not a url', 'homelab.tail861ffd.ts.net'), true);
});

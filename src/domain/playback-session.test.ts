import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldClearCurrentPlaybackSession } from './playback-session';

test('clears the current session only after a video is watched', () => {
  assert.equal(shouldClearCurrentPlaybackSession('unwatched'), false);
  assert.equal(shouldClearCurrentPlaybackSession('in_progress'), false);
  assert.equal(shouldClearCurrentPlaybackSession('watched'), true);
});

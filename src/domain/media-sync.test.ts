import assert from 'node:assert/strict';
import test from 'node:test';
import { needsMediaSync } from './media-sync';

test('corrects playback drift only after the tolerance is exceeded', () => {
  assert.equal(needsMediaSync(10, 10.2), false);
  assert.equal(needsMediaSync(10, 10.251), true);
  assert.equal(needsMediaSync(10.5, 10), true);
});

test('ignores media times that are not finite', () => {
  assert.equal(needsMediaSync(Number.NaN, 1), false);
  assert.equal(needsMediaSync(1, Number.POSITIVE_INFINITY), false);
});

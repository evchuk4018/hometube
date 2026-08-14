import assert from 'node:assert/strict';
import test from 'node:test';
import { getResumePosition } from './playback-progress';

test('resumes an unfinished video from its saved position', () => {
  assert.equal(getResumePosition(40, 100, 'in_progress'), 40);
});

test('does not resume completed videos', () => {
  assert.equal(getResumePosition(40, 100, 'watched'), 0);
});

test('does not seek when saved position is at the end', () => {
  assert.equal(getResumePosition(96, 100, 'in_progress'), 0);
  assert.equal(getResumePosition(95, 100, 'in_progress'), 0);
});

test('handles missing or invalid media timing safely', () => {
  assert.equal(getResumePosition(0, 100, 'in_progress'), 0);
  assert.equal(getResumePosition(40, 0, 'in_progress'), 0);
  assert.equal(getResumePosition(40, Number.NaN, 'in_progress'), 0);
  assert.equal(getResumePosition(Number.POSITIVE_INFINITY, 100, 'in_progress'), 0);
});

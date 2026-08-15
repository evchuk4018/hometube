import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQueue, QUEUE_SIZE, type AutoplayCandidate } from './autoplay-queue';

function candidate(videoId: string, watchState: AutoplayCandidate['watchState'] = 'unwatched'): AutoplayCandidate {
  return { videoId, watchState };
}

test('starts a fresh queue from the current video and fills from ranked candidates', () => {
  const queue = buildQueue('a', [], [candidate('x'), candidate('y'), candidate('z')]);
  assert.deepEqual(queue, ['a', 'x', 'y']);
  assert.equal(queue.length, QUEUE_SIZE);
});

test('keeps the existing tail when advancing to the next queue entry', () => {
  const queue = buildQueue('b', ['a', 'b', 'c'], [candidate('x'), candidate('y')]);
  assert.deepEqual(queue, ['b', 'c', 'x']);
});

test('reopening the current head leaves the queue untouched', () => {
  const queue = buildQueue('a', ['a', 'b', 'c'], [candidate('x'), candidate('y')]);
  assert.deepEqual(queue, ['a', 'b', 'c']);
});

test('rebuilds from scratch when the current video is not in the queue', () => {
  const queue = buildQueue('d', ['a', 'b', 'c'], [candidate('x'), candidate('y')]);
  assert.deepEqual(queue, ['d', 'x', 'y']);
});

test('never recommends watched videos', () => {
  const queue = buildQueue('a', [], [
    candidate('x', 'watched'),
    candidate('y', 'watched'),
    candidate('z')
  ]);
  assert.deepEqual(queue, ['a', 'z']);
});

test('never recommends the current video or videos already queued', () => {
  const queue = buildQueue('a', ['a', 'b'], [candidate('a'), candidate('b'), candidate('c'), candidate('d')]);
  assert.deepEqual(queue, ['a', 'b', 'c']);
});

test('returns a shorter queue when candidates run out', () => {
  const queue = buildQueue('a', [], [candidate('x')]);
  assert.deepEqual(queue, ['a', 'x']);
});

test('keeps at most the queue size even with a long existing tail', () => {
  const queue = buildQueue('b', ['a', 'b', 'c', 'd', 'e'], [candidate('x')]);
  assert.equal(queue.length, QUEUE_SIZE);
  assert.deepEqual(queue, ['b', 'c', 'd']);
});

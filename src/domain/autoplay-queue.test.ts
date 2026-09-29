import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQueue,
  dismissQueuedVideo,
  QUEUE_SIZE,
  queueSessionExcludedChannels,
  type AutoplayCandidate,
  type AutoplayQueueItem
} from './autoplay-queue';

function item(videoId: string, channelId = videoId): AutoplayQueueItem {
  return { videoId, channelId };
}

function candidate(videoId: string, channelId = videoId, watchState: AutoplayCandidate['watchState'] = 'unwatched'): AutoplayCandidate {
  return { videoId, channelId, watchState };
}

function ids(queue: AutoplayQueueItem[]): string[] {
  return queue.map((entry) => entry.videoId);
}

test('starts a fresh queue from the current video and fills from ranked candidates', () => {
  const queue = buildQueue(item('a', 'cha'), [], [candidate('x', 'chx'), candidate('y', 'chy'), candidate('z', 'chz')]);
  assert.deepEqual(ids(queue), ['a', 'x', 'y']);
  assert.equal(queue.length, QUEUE_SIZE);
});

test('keeps the existing tail when advancing to the next queue entry', () => {
  const queue = buildQueue(item('b', 'chb'), [item('a', 'cha'), item('b', 'chb'), item('c', 'chc')], [candidate('x', 'chx'), candidate('y', 'chy')]);
  assert.deepEqual(ids(queue), ['b', 'c', 'x']);
});

test('reopening the current head leaves the queue untouched', () => {
  const queue = buildQueue(item('a', 'cha'), [item('a', 'cha'), item('b', 'chb'), item('c', 'chc')], [candidate('x', 'chx'), candidate('y', 'chy')]);
  assert.deepEqual(ids(queue), ['a', 'b', 'c']);
});

test('rebuilds from scratch when the current video is not in the queue', () => {
  const queue = buildQueue(item('d', 'chd'), [item('a', 'cha'), item('b', 'chb'), item('c', 'chc')], [candidate('x', 'chx'), candidate('y', 'chy')]);
  assert.deepEqual(ids(queue), ['d', 'x', 'y']);
});

test('never recommends watched videos', () => {
  const queue = buildQueue(item('a', 'cha'), [], [
    candidate('x', 'chx', 'watched'),
    candidate('y', 'chy', 'watched'),
    candidate('z', 'chz')
  ]);
  assert.deepEqual(ids(queue), ['a', 'z']);
});

test('never recommends the current video or videos already queued', () => {
  const queue = buildQueue(item('a', 'cha'), [item('a', 'cha'), item('b', 'chb')], [
    candidate('a', 'cha'),
    candidate('b', 'chb'),
    candidate('c', 'chc'),
    candidate('d', 'chd')
  ]);
  assert.deepEqual(ids(queue), ['a', 'b', 'c']);
});

test('returns a shorter queue when candidates run out', () => {
  const queue = buildQueue(item('a', 'cha'), [], [candidate('x', 'chx')]);
  assert.deepEqual(ids(queue), ['a', 'x']);
});

test('keeps at most the queue size even with a long existing tail', () => {
  const queue = buildQueue(item('b', 'chb'), [item('a', 'cha'), item('b', 'chb'), item('c', 'chc'), item('d', 'chd'), item('e', 'che')], [candidate('x', 'chx')]);
  assert.equal(queue.length, QUEUE_SIZE);
  assert.deepEqual(ids(queue), ['b', 'c', 'd']);
});

test('skips candidates from excluded channels', () => {
  const queue = buildQueue(item('a', 'cha'), [], [candidate('x1', 'chx'), candidate('y1', 'chy')], new Set(['chx']));
  assert.deepEqual(ids(queue), ['a', 'y1']);
});

test('skips every video from an excluded channel', () => {
  const queue = buildQueue(item('a', 'cha'), [], [
    candidate('x1', 'chx'),
    candidate('x2', 'chx'),
    candidate('x3', 'chx'),
    candidate('y1', 'chy')
  ], new Set(['chx']));
  assert.deepEqual(ids(queue), ['a', 'y1']);
});

test('drops existing queue entries from excluded channels', () => {
  const queue = buildQueue(item('a1', 'cha'), [item('a1', 'cha'), item('x1', 'chx'), item('x2', 'chx')], [], new Set(['chx']));
  assert.deepEqual(ids(queue), ['a1']);
});

test('refills vacant queue positions from other channels after a dismissal', () => {
  const dismissal = dismissQueuedVideo(
    item('a1', 'cha'),
    [item('a1', 'cha'), item('x1', 'chx'), item('x2', 'chx')],
    'x1',
    new Set(),
    [candidate('y1', 'chy'), candidate('z1', 'chz')]
  );
  assert.deepEqual(ids(dismissal?.queue ?? []), ['a1', 'y1', 'z1']);
  assert.deepEqual(dismissal?.excludedChannelIds, ['chx']);
});

test('removes all upcoming videos from the dismissed channel', () => {
  const dismissal = dismissQueuedVideo(
    item('a1', 'cha'),
    [item('a1', 'cha'), item('x1', 'chx'), item('x2', 'chx'), item('y1', 'chy')],
    'x1',
    new Set(),
    []
  );
  assert.deepEqual(ids(dismissal?.queue ?? []), ['a1', 'y1']);
});

test('keeps the current video even when its channel is excluded', () => {
  const queue = buildQueue(item('a1', 'cha'), [], [candidate('a2', 'cha'), candidate('d1', 'chd')], new Set(['cha']));
  assert.deepEqual(ids(queue), ['a1', 'd1']);
});

test('keeps the current video when it leads a queue whose channel is excluded', () => {
  const queue = buildQueue(item('a1', 'cha'), [item('a1', 'cha'), item('b1', 'chb')], [candidate('c1', 'cha')], new Set(['cha']));
  assert.deepEqual(ids(queue), ['a1', 'b1']);
});

test('returns a queue shorter than the queue size when every candidate is excluded', () => {
  const queue = buildQueue(item('a1', 'cha'), [], [candidate('x1', 'chx'), candidate('x2', 'chx')], new Set(['chx']));
  assert.deepEqual(ids(queue), ['a1']);
});

test('channel exclusion works alongside watched and duplicate filtering', () => {
  const queue = buildQueue(
    item('a', 'cha'),
    [item('a', 'cha'), item('b', 'chb')],
    [candidate('b', 'chb'), candidate('c', 'chc', 'watched'), candidate('d', 'chd'), candidate('e', 'chx')],
    new Set(['chx'])
  );
  assert.deepEqual(ids(queue), ['a', 'b', 'd']);
});

test('channel exclusion still respects the queue size cap', () => {
  const queue = buildQueue(
    item('a', 'cha'),
    [],
    [candidate('x', 'chx'), candidate('y', 'chy'), candidate('z', 'chz'), candidate('w', 'chw')],
    new Set(['chx'])
  );
  assert.equal(queue.length, QUEUE_SIZE);
  assert.deepEqual(ids(queue), ['a', 'y', 'z']);
});

test('refuses to dismiss the current video', () => {
  const dismissal = dismissQueuedVideo(item('a', 'cha'), [item('a', 'cha'), item('b', 'chb')], 'a', new Set(), []);
  assert.equal(dismissal, null);
});

test('refuses to dismiss a video that is not in the queue', () => {
  const dismissal = dismissQueuedVideo(item('a', 'cha'), [item('a', 'cha')], 'missing', new Set(), []);
  assert.equal(dismissal, null);
});

test('keeps prior exclusions and deduplicates them when dismissing', () => {
  const dismissal = dismissQueuedVideo(item('a', 'cha'), [item('a', 'cha'), item('b', 'chb')], 'b', new Set(['chz', 'chb']), []);
  assert.deepEqual([...new Set(dismissal?.excludedChannelIds ?? [])].sort(), ['chb', 'chz']);
});

test('keeps exclusions while advancing within the same queue session', () => {
  const dismissal = dismissQueuedVideo(
    item('a', 'cha'),
    [item('a', 'cha'), item('b', 'chb'), item('c', 'chc')],
    'b',
    new Set(),
    [candidate('d', 'chd')]
  );
  assert.deepEqual(ids(dismissal?.queue ?? []), ['a', 'c', 'd']);
  const next = buildQueue(item('c', 'chc'), dismissal?.queue ?? [], [candidate('e', 'che')], new Set(dismissal?.excludedChannelIds ?? []));
  assert.deepEqual(ids(next), ['c', 'd', 'e']);
});

test('keeps excluded channels while continuing a session', () => {
  const kept = queueSessionExcludedChannels('b', [item('a', 'cha'), item('b', 'chb')], ['chx']);
  assert.deepEqual(kept, ['chx']);
});

test('clears excluded channels when the current video starts a new queue', () => {
  const cleared = queueSessionExcludedChannels('z', [item('a', 'cha'), item('b', 'chb')], ['chx']);
  assert.deepEqual(cleared, []);
});

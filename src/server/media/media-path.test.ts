import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { resolveMediaPath } from './media-path';

test('resolves contained media paths', () => {
  assert.equal(resolveMediaPath('videos/abc.mp4', '/srv/media'), path.resolve('/srv/media/videos/abc.mp4'));
});

test('rejects absolute and traversing media paths', () => {
  assert.throws(() => resolveMediaPath('../secret', '/srv/media'));
  assert.throws(() => resolveMediaPath(path.resolve('/outside/file.mp4'), '/srv/media'));
});


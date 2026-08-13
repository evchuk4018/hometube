import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackgroundAudioArgs } from './background-audio';

test('copies only the first audio track into an MP4 audio container', () => {
  const args = buildBackgroundAudioArgs('/media/source.mp4', '/media/output.m4a');
  assert.deepEqual(args, [
    '-nostdin', '-y', '-i', '/media/source.mp4',
    '-map', '0:a:0', '-vn', '-c:a', 'copy',
    '-movflags', '+faststart', '-f', 'mp4', '/media/output.m4a'
  ]);
});

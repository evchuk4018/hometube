import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDownloadArgs, parseDownloadProgress } from './download-adapter';

test('download arguments enforce 720p and a single MP4 output', () => {
  const args = buildDownloadArgs('abcdefghijk', '/tmp/source.%(ext)s');
  const format = args[args.indexOf('--format') + 1];
  assert.match(format, /height<=720/);
  assert.ok(args.includes('--merge-output-format'));
  assert.equal(args[args.indexOf('--js-runtimes') + 1], 'node:/usr/local/bin/node');
  assert.equal(args.at(-1), 'https://www.youtube.com/watch?v=abcdefghijk');
});

test('parses newline download progress', () => {
  assert.equal(parseDownloadProgress('[download]  42.5% of 10MiB'), 42.5);
  assert.equal(parseDownloadProgress('[Merger] Merging formats'), null);
});

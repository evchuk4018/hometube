import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogArgs, mapCatalogEntry } from './yt-dlp-adapter';

test('catalog extraction uses a flat progressive playlist', () => {
  const args = buildCatalogArgs('https://www.youtube.com/@example/videos');
  assert.ok(args.includes('--flat-playlist'));
  assert.ok(args.includes('--lazy-playlist'));
  assert.ok(args.includes('--dump-json'));
  assert.equal(args[args.indexOf('--js-runtimes') + 1], 'node:/usr/local/bin/node');
  assert.equal(args.at(-1), 'https://www.youtube.com/@example/videos');
});

test('uses playlist identity from flat channel entries', () => {
  const mapped = mapCatalogEntry({
    id: 'abcdefghijk', title: 'A video', playlist_channel: 'Example Channel',
    playlist_channel_id: 'UCexample', playlist_uploader_id: '@example'
  });
  assert.equal(mapped?.channel.name, 'Example Channel');
  assert.equal(mapped?.channel.youtubeChannelId, 'UCexample');
  assert.equal(mapped?.channel.handle, '@example');
});

test('maps a yt-dlp entry to stable local metadata', () => {
  const mapped = mapCatalogEntry({
    id: 'abcdefghijk', title: 'A video', upload_date: '20260102', duration: 12.4,
    channel_id: 'UC123', channel: 'Example', uploader_id: '@example', view_count: 42
  });
  assert.equal(mapped?.video.uploadDate, '2026-01-02');
  assert.equal(mapped?.video.durationSeconds, 12);
  assert.equal(mapped?.video.thumbnailUrl, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  assert.equal(mapped?.channel.youtubeChannelId, 'UC123');
});

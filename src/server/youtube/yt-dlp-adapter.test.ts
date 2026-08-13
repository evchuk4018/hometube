import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalogArgs, mapCatalogEntry } from './yt-dlp-adapter';

test('catalog extraction uses a flat progressive playlist', () => {
  const args = buildCatalogArgs('https://www.youtube.com/@example/videos');
  assert.ok(args.includes('--flat-playlist'));
  assert.ok(args.includes('--lazy-playlist'));
  assert.ok(args.includes('--dump-json'));
  assert.equal(args.at(-1), 'https://www.youtube.com/@example/videos');
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


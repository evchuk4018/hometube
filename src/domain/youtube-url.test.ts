import assert from 'node:assert/strict';
import test from 'node:test';
import { channelCatalogUrls, normalizeYouTubeChannelUrl } from './youtube-url';

test('normalizes supported channel URLs and strips catalog tabs', () => {
  assert.equal(normalizeYouTubeChannelUrl('youtube.com/@Example/videos?view=0'), 'https://www.youtube.com/@Example');
  assert.equal(normalizeYouTubeChannelUrl('https://m.youtube.com/channel/UC123/shorts'), 'https://www.youtube.com/channel/UC123');
  assert.equal(normalizeYouTubeChannelUrl('http://www.youtube.com/user/example'), 'https://www.youtube.com/user/example');
});

test('rejects video and non-YouTube URLs', () => {
  assert.throws(() => normalizeYouTubeChannelUrl('https://youtube.com/watch?v=abc'));
  assert.throws(() => normalizeYouTubeChannelUrl('https://example.com/@channel'));
});

test('builds all three catalog URLs', () => {
  assert.deepEqual(channelCatalogUrls('https://youtube.com/@Example'), [
    'https://www.youtube.com/@Example/videos',
    'https://www.youtube.com/@Example/shorts',
    'https://www.youtube.com/@Example/streams'
  ]);
});


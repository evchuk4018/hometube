import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mediaAssetResponse } from './media-service';

test('serves full, head, partial, and unsatisfiable audio responses', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hometube-media-'));
  try {
    await writeFile(path.join(root, 'sample.m4a'), Buffer.from('0123456789'));
    const media = {
      videoId: 'abcdefghijk',
      relativePath: 'sample.m4a',
      sizeBytes: 10,
      contentType: 'audio/mp4'
    };

    const full = await mediaAssetResponse(media, new Request('http://example.test/audio'), false, root);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'audio/mp4');
    assert.equal(full.headers.get('content-length'), '10');
    assert.equal(await full.text(), '0123456789');

    const head = await mediaAssetResponse(media, new Request('http://example.test/audio'), true, root);
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), '10');
    assert.equal(await head.text(), '');

    const partial = await mediaAssetResponse(media, new Request('http://example.test/audio', {
      headers: { Range: 'bytes=2-5' }
    }), false, root);
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await partial.text(), '2345');

    const invalid = await mediaAssetResponse(media, new Request('http://example.test/audio', {
      headers: { Range: 'bytes=20-30' }
    }), false, root);
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), 'bytes */10');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

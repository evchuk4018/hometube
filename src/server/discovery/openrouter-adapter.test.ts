import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateCandidates, normalizeEnvironmentSecret } from './openrouter-adapter';

test('removes repeated and previously evaluated discovery candidates', () => {
  const candidates = deduplicateCandidates([
    { name: 'One', url: 'https://www.youtube.com/@one', reason: 'Related' },
    { name: 'One again', url: 'https://www.youtube.com/@one/', reason: 'Related' },
    { name: 'Known', url: 'https://www.youtube.com/@known', reason: 'Related' }
  ], ['https://www.youtube.com/@known']);
  assert.deepEqual(candidates.map((item) => item.name), ['One']);
});

test('normalizes secrets wrapped by deployment environment files', () => {
  assert.equal(normalizeEnvironmentSecret("'secret'"), 'secret');
  assert.equal(normalizeEnvironmentSecret('"secret"'), 'secret');
  assert.equal(normalizeEnvironmentSecret(' secret '), 'secret');
});

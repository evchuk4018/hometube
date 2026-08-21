import assert from 'node:assert/strict';
import test from 'node:test';

test('imported count increments only after successful onEntry', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('./yt-dlp-adapter.ts', import.meta.url), 'utf8');
  assert.match(source, /const nextCount = importedCount \+ 1/);
  assert.match(source, /await onEntry\(entry, nextCount\)/);
  assert.match(source, /importedCount = nextCount/);
  assert.doesNotMatch(source, /importedCount \+= 1;\s*\n\s*await onEntry/);
});

test('catalog extraction uses timeout to avoid hanging', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('./yt-dlp-adapter.ts', import.meta.url), 'utf8');
  assert.match(source, /timeoutMs: 90_000/);
  assert.match(source, /timeoutMs: 60_000/);
});

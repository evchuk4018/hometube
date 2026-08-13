import assert from 'node:assert/strict';
import test from 'node:test';
import { parseByteRange } from './media-range';

test('parses explicit, open, and suffix ranges', () => {
  assert.deepEqual(parseByteRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.equal(parseByteRange(null, 100), null);
});

test('rejects multiple or unsatisfiable ranges', () => {
  assert.throws(() => parseByteRange('bytes=0-1,4-5', 100), RangeError);
  assert.throws(() => parseByteRange('bytes=100-', 100), RangeError);
  assert.throws(() => parseByteRange('bytes=20-10', 100), RangeError);
});


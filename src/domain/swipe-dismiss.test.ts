import assert from 'node:assert/strict';
import test from 'node:test';
import { isHorizontalSwipe, shouldDismissSwipe, SWIPE_DISMISS_THRESHOLD } from './swipe-dismiss';

test('a large left swipe dismisses the row', () => {
  assert.equal(shouldDismissSwipe(-(SWIPE_DISMISS_THRESHOLD + 10), 4), true);
  assert.equal(shouldDismissSwipe(-160, 10), true);
});

test('a small left swipe does not dismiss the row', () => {
  assert.equal(shouldDismissSwipe(-20, 2), false);
  assert.equal(shouldDismissSwipe(-(SWIPE_DISMISS_THRESHOLD - 1), 1), false);
});

test('a right swipe does not dismiss the row', () => {
  assert.equal(shouldDismissSwipe(120, 4), false);
});

test('a vertical gesture does not dismiss the row', () => {
  assert.equal(shouldDismissSwipe(-120, 220), false);
  assert.equal(shouldDismissSwipe(-120, 100), false);
});

test('horizontal movement must clearly dominate vertical movement', () => {
  assert.equal(isHorizontalSwipe(-120, 100), false);
  assert.equal(isHorizontalSwipe(-120, 80), true);
  assert.equal(isHorizontalSwipe(0, 0), false);
});

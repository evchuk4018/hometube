import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_MINUTES, adjustMinutes, formatCountdown } from './sleep-timer';

test('adjusts minutes in fixed steps from zero', () => {
  assert.equal(adjustMinutes(0, 5), 5);
  assert.equal(adjustMinutes(5, 5), 10);
  assert.equal(adjustMinutes(10, -5), 5);
});

test('never drops below zero minutes', () => {
  assert.equal(adjustMinutes(0, -5), 0);
  assert.equal(adjustMinutes(5, -5), 0);
});

test('clamps to the maximum timer length', () => {
  assert.equal(adjustMinutes(MAX_MINUTES, 5), MAX_MINUTES);
  assert.equal(adjustMinutes(MAX_MINUTES - 5, 5), MAX_MINUTES);
});

test('formats countdowns as minutes and padded seconds', () => {
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(65), '1:05');
  assert.equal(formatCountdown(3599), '59:59');
  assert.equal(formatCountdown(7200), '120:00');
});

test('formats negative or fractional times as zero', () => {
  assert.equal(formatCountdown(-10), '0:00');
  assert.equal(formatCountdown(64.9), '1:04');
});

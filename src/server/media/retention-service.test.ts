import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readRetentionConfig, removeMediaFiles, retentionCutoff, retentionThresholds } from './retention-service';
import type { EvictionTarget } from './retention-repository';

function target(overrides: Partial<EvictionTarget>): EvictionTarget {
  return {
    videoId: 'abc',
    relativePath: 'videos/abc.mp4',
    audioRelativePath: 'videos/abc.m4a',
    sizeBytes: 100,
    audioSizeBytes: 20,
    ...overrides
  };
}

test('retention cutoff is exactly N days before now', () => {
  const now = new Date('2026-08-15T12:00:00Z');
  const cutoff = retentionCutoff(30, now);
  assert.equal(cutoff.toISOString(), '2026-07-16T12:00:00.000Z');
  assert.ok(retentionCutoff(1, now) > retentionCutoff(60, now));
});

test('retention thresholds are the configured percentages of the cap', () => {
  const { highBytes, lowBytes } = retentionThresholds(1000, 0.9, 0.8);
  assert.equal(highBytes, 900);
  assert.equal(lowBytes, 800);
});

test('default config is 30 days and 256 GiB with 90/80 percent thresholds', () => {
  const config = readRetentionConfig({});
  assert.equal(config.retentionDays, 30);
  assert.equal(config.highBytes, 256 * 1024 ** 3 * 0.9);
  assert.equal(config.lowBytes, 256 * 1024 ** 3 * 0.8);
});

test('config honors explicit environment values', () => {
  const config = readRetentionConfig({
    HOMETUBE_RETENTION_DAYS: '7',
    HOMETUBE_MEDIA_CAP_BYTES: '1000000',
    HOMETUBE_MEDIA_CAP_HIGH_PCT: '0.5',
    HOMETUBE_MEDIA_CAP_LOW_PCT: '0.25'
  });
  assert.equal(config.retentionDays, 7);
  assert.equal(config.highBytes, 500000);
  assert.equal(config.lowBytes, 250000);
});

test('invalid env values fall back to defaults', () => {
  const config = readRetentionConfig({
    HOMETUBE_RETENTION_DAYS: 'nope',
    HOMETUBE_MEDIA_CAP_BYTES: '-5',
    HOMETUBE_MEDIA_CAP_HIGH_PCT: '2',
    HOMETUBE_MEDIA_CAP_LOW_PCT: '0'
  });
  assert.equal(config.retentionDays, 30);
  assert.equal(config.highBytes, 256 * 1024 ** 3 * 0.9);
  assert.equal(config.lowBytes, 256 * 1024 ** 3 * 0.8);
});

test('removeMediaFiles deletes the video and audio assets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hometube-retention-'));
  try {
    const videoPath = path.join(root, 'videos', 'abc.mp4');
    const audioPath = path.join(root, 'videos', 'abc.m4a');
    await mkdir(path.dirname(videoPath), { recursive: true });
    await writeFile(videoPath, 'video');
    await writeFile(audioPath, 'audio');

    await removeMediaFiles(target({}), root);

    await assert.rejects(readFile(videoPath), /ENOENT/);
    await assert.rejects(readFile(audioPath), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('removeMediaFiles tolerates assets that are already missing and leaves unrelated files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hometube-retention-'));
  try {
    await writeFile(path.join(root, 'keep.mp4'), 'keep');
    await removeMediaFiles(target({ audioRelativePath: null, relativePath: 'missing.mp4' }), root);
    assert.equal(await readFile(path.join(root, 'keep.mp4'), 'utf8'), 'keep');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

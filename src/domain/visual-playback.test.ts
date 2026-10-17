import assert from 'node:assert/strict';
import test from 'node:test';
import { followAudioPlayback } from './visual-playback';

class FakeMedia extends EventTarget {
  position = 0;
  duration = 300;
  paused = true;
  ended = false;
  seeking = false;
  readyState = 4;
  playbackRate = 1;
  seeks: number[] = [];
  plays = 0;
  loads = 0;
  playResult: (() => Promise<void>) | undefined;
  get currentTime() { return this.position; }
  set currentTime(value: number) { this.position = value; this.seeks.push(value); this.seeking = true; }
  play() {
    this.plays++;
    if (this.playResult) return this.playResult();
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  load() { this.loads++; this.readyState = 0; this.seeking = false; this.paused = true; }
  emit(event: string) { this.dispatchEvent(new Event(event)); }
  finishSeek() { this.seeking = false; this.emit('seeked'); }
}
class FakeVisibility extends EventTarget {
  hidden = false;
  setHidden(value: boolean) { this.hidden = value; this.dispatchEvent(new Event('visibilitychange')); }
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function setup() {
  const audio = new FakeMedia();
  const video = new FakeMedia();
  const visibility = new FakeVisibility();
  let clock = 0;
  let tick = () => {};
  const errors: unknown[] = [];
  const start = () => followAudioPlayback(audio, video, visibility, {
    now: () => clock, onPlayError: (error) => errors.push(error),
    schedule: (handler) => { tick = handler; return () => { tick = () => {}; }; }
  });
  return { audio, video, visibility, errors, start, tick: () => tick(), advance: (ms: number) => { clock += ms; } };
}

test('foreground return aligns once and waits for seek completion before playing', async () => {
  const { audio, video, visibility, start } = setup();
  audio.paused = false;
  const stop = start();
  await settle();
  visibility.setHidden(true);
  assert.equal(video.paused, true);
  audio.position = 60;
  visibility.setHidden(false);
  for (let i = 0; i < 20; i++) audio.emit('timeupdate');
  assert.deepEqual(video.seeks, [60]);
  assert.equal(video.plays, 1);
  video.finishSeek();
  assert.equal(video.plays, 2);
  stop();
});

test('a queued video waits for metadata, seeked, and playable data', () => {
  const { audio, video, start } = setup();
  audio.paused = false;
  audio.position = 25;
  video.readyState = 0;
  const stop = start();
  audio.emit('playing');
  assert.deepEqual(video.seeks, []);
  video.readyState = 1;
  video.emit('loadedmetadata');
  assert.deepEqual(video.seeks, [25]);
  video.finishSeek();
  assert.equal(video.plays, 0);
  video.readyState = 3;
  video.emit('canplay');
  assert.equal(video.plays, 1);
  stop();
});

test('small drift changes speed without seeking and restores the requested rate', async () => {
  const { audio, video, start } = setup();
  audio.paused = false;
  audio.playbackRate = 1.5;
  const stop = start();
  await settle();
  audio.position = 10.7;
  video.position = 10;
  audio.emit('timeupdate');
  assert.equal(video.playbackRate, 1.5 * 1.05);
  assert.deepEqual(video.seeks, []);
  video.position = 10.6;
  audio.emit('timeupdate');
  assert.equal(video.playbackRate, 1.5);
  stop();
});

test('large drift does not repeatedly seek a running video while decoding catches up', async () => {
  const { audio, video, start, advance } = setup();
  audio.paused = false;
  audio.position = 10;
  const stop = start();
  video.finishSeek();
  await settle();
  audio.position = 12;
  for (let i = 0; i < 20; i++) { advance(200); audio.emit('timeupdate'); }
  assert.deepEqual(video.seeks, [10]);
  advance(1_000);
  audio.emit('timeupdate');
  assert.deepEqual(video.seeks, [10]);
  stop();
});

test('serializes pending play requests and pauses a late resolution after hiding', async () => {
  const { audio, video, visibility, start } = setup();
  audio.paused = false;
  let resolvePlay!: () => void;
  video.playResult = () => new Promise<void>((resolve) => { resolvePlay = resolve; });
  const stop = start();
  for (let i = 0; i < 20; i++) { audio.emit('timeupdate'); video.emit('canplay'); }
  assert.equal(video.plays, 1);
  visibility.setHidden(true);
  video.paused = false;
  resolvePlay();
  await settle();
  assert.equal(video.paused, true);
  stop();
});

test('play rejection is reported and retries are bounded', async () => {
  const { audio, video, start, errors, advance } = setup();
  audio.paused = false;
  video.playResult = () => Promise.reject(new Error('not ready'));
  const stop = start();
  await settle();
  for (let i = 0; i < 20; i++) audio.emit('timeupdate');
  assert.equal(video.plays, 1);
  assert.equal(errors.length, 1);
  advance(3_000);
  video.playResult = undefined;
  audio.emit('timeupdate');
  await settle();
  assert.equal(video.plays, 2);
  assert.equal(video.paused, false);
  stop();
});

test('audio seeks wait for completion and paused audio never starts the video', async () => {
  const { audio, video, start } = setup();
  const stop = start();
  assert.equal(video.plays, 0);
  audio.paused = false;
  audio.emit('playing');
  await settle();
  audio.seeking = true;
  audio.position = 80;
  audio.emit('seeking');
  audio.emit('timeupdate');
  assert.deepEqual(video.seeks, []);
  audio.finishSeek();
  assert.deepEqual(video.seeks, [80]);
  video.finishSeek();
  await settle();
  audio.paused = true;
  audio.emit('pause');
  assert.equal(video.paused, true);
  stop();
});

test('buffering audio pauses video until playing resumes', async () => {
  const { audio, video, start } = setup();
  audio.paused = false;
  const stop = start();
  await settle();
  audio.emit('waiting');
  audio.emit('timeupdate');
  assert.equal(video.paused, true);
  audio.emit('playing');
  assert.equal(video.paused, false);
  stop();
});

test('disposing a previous track detaches listeners and ignores late play failures', async () => {
  const { audio, video, visibility, start, errors } = setup();
  audio.paused = false;
  let rejectPlay!: (error: Error) => void;
  video.playResult = () => new Promise<void>((_, reject) => { rejectPlay = reject; });
  const stop = start();
  stop();
  rejectPlay(new Error('source replaced'));
  await settle();
  audio.position = 100;
  audio.emit('timeupdate');
  video.emit('canplay');
  visibility.setHidden(false);
  assert.deepEqual(errors, []);
  assert.deepEqual(video.seeks, []);
  assert.equal(video.plays, 1);
});

test('watchdog resumes a paused follower without audio timeupdate events', async () => {
  const { audio, video, start, tick } = setup();
  audio.paused = false;
  const stop = start();
  await settle();
  video.paused = true;
  tick();
  assert.equal(video.plays, 2);
  stop();
  await settle();
  tick();
  assert.equal(video.plays, 2);
});

test('a stuck seek reloads only video and realigns after metadata arrives', () => {
  const { audio, video, start, tick, advance } = setup();
  audio.paused = false;
  audio.position = 30;
  const stop = start();
  advance(8_000);
  tick();
  assert.equal(video.loads, 1);
  assert.equal(audio.loads, 0);
  audio.position = 38;
  video.readyState = 4;
  video.emit('loadedmetadata');
  assert.deepEqual(video.seeks, [30, 38]);
  video.finishSeek();
  assert.equal(video.plays, 1);
  stop();
});

test('a hung play is replaced and its stale completion cannot affect the replacement', async () => {
  const { audio, video, start, tick, advance } = setup();
  audio.paused = false;
  let rejectOld!: (error: Error) => void;
  video.playResult = () => new Promise<void>((_, reject) => { rejectOld = reject; });
  const stop = start();
  advance(8_000);
  tick();
  assert.equal(video.loads, 1);
  video.playResult = undefined;
  video.readyState = 4;
  video.emit('canplay');
  await settle();
  rejectOld(new Error('aborted old pipeline'));
  await settle();
  video.paused = true;
  tick();
  assert.equal(video.plays, 3);
  stop();
});

test('a resolved play with a frozen video clock is recovered without repeated seeks', async () => {
  const { audio, video, start, tick, advance } = setup();
  audio.paused = false;
  const stop = start();
  await settle();
  for (let i = 0; i < 16; i++) {
    advance(500);
    audio.position += 0.5;
    tick();
  }
  assert.deepEqual(video.seeks, []);
  assert.equal(video.loads, 1);
  assert.equal(audio.loads, 0);
  stop();
});

test('frame progress detects a frozen picture even if the video clock advances', async () => {
  const { audio, video, start, tick, advance } = setup();
  Object.assign(video, { getVideoPlaybackQuality: () => ({ totalVideoFrames: 1 }) });
  audio.paused = false;
  const stop = start();
  await settle();
  for (let i = 0; i < 16; i++) {
    advance(500);
    audio.position += 0.5;
    video.position += 0.5;
    tick();
  }
  assert.equal(video.loads, 1);
  stop();
});

test('canplay clears audio buffering without starting paused audio', async () => {
  const { audio, video, start } = setup();
  audio.paused = false;
  const stop = start();
  await settle();
  audio.emit('waiting');
  audio.emit('canplay');
  assert.equal(video.paused, false);
  await settle();
  audio.emit('waiting');
  audio.paused = true;
  audio.emit('canplay');
  assert.equal(video.paused, true);
  stop();
});

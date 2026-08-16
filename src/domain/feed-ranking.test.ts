import assert from 'node:assert/strict';
import test from 'node:test';
import { playbackState, rankScore, REFRESH_PENALTY, selectRankedFeed, type RankingCandidate } from './feed-ranking';

function candidate(overrides: Partial<RankingCandidate> & Pick<RankingCandidate, 'videoId' | 'channelId'>): RankingCandidate {
  return {
    trial: false, subscribed: true, watchState: 'unwatched', watchPercentage: 0, uploadDate: '2026-08-12',
    viewCount: 100, channelViewMax: 1000, channelWeightedWatch: 0, channelEvidence: 0, refreshPenalty: 0,
    ...overrides
  };
}

test('ranking favors engagement first, then recency, views, and subscription', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const engaged = candidate({ videoId: 'engaged', channelId: 'a', channelWeightedWatch: 4, channelEvidence: 5 });
  const cold = candidate({ videoId: 'cold', channelId: 'b', channelWeightedWatch: 0, channelEvidence: 5 });
  assert.ok(rankScore(engaged, now) > rankScore(cold, now));
  assert.ok(rankScore(candidate({ videoId: 'new', channelId: 'a' }), now)
    > rankScore(candidate({ videoId: 'old', channelId: 'a', uploadDate: '2026-01-01' }), now));
});

test('videos over fifty percent watched are docked below unwatched ones', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const unwatched = candidate({ videoId: 'unwatched', channelId: 'a' });
  const mostlyWatched = candidate({ videoId: 'mostly', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.75 });
  assert.ok(rankScore(unwatched, now) > rankScore(mostlyWatched, now));
});

test('the penalty grows from fifty to eighty percent watched', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const half = candidate({ videoId: 'half', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.5 });
  const sixty = candidate({ videoId: 'sixty', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.6 });
  const seventyFive = candidate({ videoId: 'seventy-five', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.75 });
  assert.ok(rankScore(half, now) > rankScore(sixty, now));
  assert.ok(rankScore(sixty, now) > rankScore(seventyFive, now));
});

test('in-progress videos under fifty percent outrank over-fifty percent ones', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const barelyStarted = candidate({ videoId: 'barely', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.4 });
  const mostlyWatched = candidate({ videoId: 'mostly', channelId: 'a', watchState: 'in_progress', watchPercentage: 0.6 });
  assert.ok(rankScore(barelyStarted, now) > rankScore(mostlyWatched, now));
});

test('feed excludes watched videos, reserves trials, and caps channels', () => {
  const items = [
    ...Array.from({ length: 10 }, (_, index) => candidate({ videoId: `a${index}`, channelId: 'a' })),
    ...Array.from({ length: 6 }, (_, index) => candidate({ videoId: `b${index}`, channelId: `b${index}`, trial: true })),
    candidate({ videoId: 'watched', channelId: 'z', watchState: 'watched' })
  ];
  const selected = selectRankedFeed(items, 10, 0.2, 4, new Date('2026-08-13T12:00:00Z'));
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((id) => id.startsWith('a')).length, 4);
  assert.equal(selected.filter((id) => id.startsWith('b')).length, 6);
  assert.ok(!selected.includes('watched'));
});

test('a full feed uses a thirty-two to eight established/trial mix', () => {
  const established = Array.from({ length: 40 }, (_, index) => candidate({
    videoId: `established-${index}`, channelId: `established-channel-${Math.floor(index / 4)}`
  }));
  const trials = Array.from({ length: 20 }, (_, index) => candidate({
    videoId: `trial-${index}`, channelId: `trial-channel-${Math.floor(index / 4)}`, trial: true, subscribed: false
  }));
  const selected = selectRankedFeed([...established, ...trials], 40, 0.2, 4, new Date('2026-08-13T12:00:00Z'));
  assert.equal(selected.filter((id) => id.startsWith('established-')).length, 32);
  assert.equal(selected.filter((id) => id.startsWith('trial-')).length, 8);
});

test('a refresh penalty lowers the video ranking score', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const plain = candidate({ videoId: 'plain', channelId: 'a' });
  const penalized = candidate({ videoId: 'penalized', channelId: 'a', refreshPenalty: REFRESH_PENALTY });
  assert.ok(rankScore(plain, now) > rankScore(penalized, now));
});

test('a mild refresh penalty flips two otherwise-identical videos', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const penalized = candidate({ videoId: 'penalized', channelId: 'a', refreshPenalty: REFRESH_PENALTY });
  const fresh = candidate({ videoId: 'fresh', channelId: 'b' });
  assert.ok(rankScore(fresh, now) > rankScore(penalized, now));
});

test('stacked refresh penalties push a video further down', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const once = candidate({ videoId: 'once', channelId: 'a', refreshPenalty: REFRESH_PENALTY });
  const twice = candidate({ videoId: 'twice', channelId: 'a', refreshPenalty: REFRESH_PENALTY * 2 });
  assert.ok(rankScore(once, now) > rankScore(twice, now));
});

test('a refresh penalty lets the next videos take the top of the feed', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const videos = Array.from({ length: 6 }, (_, index) => candidate({ videoId: `v${index}`, channelId: `c${index}` }));
  const initial = selectRankedFeed(videos, 6, 0.2, 4, now);
  assert.equal(initial[0], 'v0');
  assert.equal(initial[1], 'v1');
  const punished = videos.map((video) =>
    video.videoId === 'v0' || video.videoId === 'v1'
      ? { ...video, refreshPenalty: REFRESH_PENALTY }
      : video
  );
  const refreshed = selectRankedFeed(punished, 6, 0.2, 4, now);
  assert.equal(refreshed[0], 'v2');
  assert.equal(refreshed[1], 'v3');
  assert.ok(refreshed.indexOf('v0') > refreshed.indexOf('v2'));
});

test('playback becomes watched at eighty percent', () => {
  assert.equal(playbackState(79, 100).state, 'in_progress');
  assert.equal(playbackState(80, 100).state, 'watched');
});

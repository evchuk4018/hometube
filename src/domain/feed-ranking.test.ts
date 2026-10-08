import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_RANKING_POLICY, HOME_RANKING_POLICY, playbackState, rankScore, REFRESH_PENALTY,
  selectRankedFeed, type RankingCandidate
} from './feed-ranking';

function candidate(overrides: Partial<RankingCandidate> & Pick<RankingCandidate, 'videoId' | 'channelId'>): RankingCandidate {
  return {
    subscribed: true, watchState: 'unwatched', watchPercentage: 0, uploadDate: '2026-08-12',
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

test('feed excludes watched and unsubscribed videos and caps channels', () => {
  const items = [
    ...Array.from({ length: 10 }, (_, index) => candidate({ videoId: `a${index}`, channelId: 'a' })),
    ...Array.from({ length: 6 }, (_, index) => candidate({ videoId: `b${index}`, channelId: `b${index}` })),
    candidate({ videoId: 'watched', channelId: 'z', watchState: 'watched' }),
    candidate({ videoId: 'unsubscribed', channelId: 'y', subscribed: false, channelWeightedWatch: 100, channelEvidence: 100 })
  ];
  const selected = selectRankedFeed(items, 10, DEFAULT_RANKING_POLICY, new Date('2026-08-13T12:00:00Z'));
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((id) => id.startsWith('a')).length, 4);
  assert.equal(selected.filter((id) => id.startsWith('b')).length, 6);
  assert.ok(!selected.includes('watched'));
  assert.ok(!selected.includes('unsubscribed'));
});

test('a dominant channel appears once in each five-channel group and at most four times overall', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].flatMap((channelId) =>
    Array.from({ length: 20 }, (_, index) => candidate({
      videoId: `${channelId}${String(index).padStart(2, '0')}`, channelId,
      channelWeightedWatch: channelId === 'a' ? 10 : 0, channelEvidence: 10
    }))
  );
  const selected = selectRankedFeed(items, 40, HOME_RANKING_POLICY, new Date('2026-08-13T12:00:00Z'));
  assert.equal(selected.length, 20);
  for (let start = 0; start < selected.length; start += 5) {
    assert.deepEqual(selected.slice(start, start + 5).map((id) => id[0]), ['a', 'b', 'c', 'd', 'e']);
  }
  assert.equal(selected.filter((id) => id.startsWith('a')).length, 4);
});

test('a full forty-video feed preserves diversity in every consecutive group', () => {
  const items = Array.from({ length: 11 }, (_, channel) =>
    Array.from({ length: 8 }, (_, index) => candidate({
      videoId: `${String(channel).padStart(2, '0')}-${index}`, channelId: `channel-${channel}`
    }))
  ).flat();
  const selected = selectRankedFeed(items, 40, HOME_RANKING_POLICY, new Date('2026-08-13T12:00:00Z'));
  const byId = new Map(items.map((item) => [item.videoId, item.channelId]));
  assert.equal(selected.length, 40);
  for (let start = 0; start < selected.length; start += 5) {
    assert.equal(new Set(selected.slice(start, start + 5).map((id) => byId.get(id))).size, 5);
  }
  for (const channelId of new Set(items.map((item) => item.channelId))) {
    assert.ok(selected.filter((id) => byId.get(id) === channelId).length <= 4);
  }
});

test('the Home profile gives subscribed videos a meaningful score advantage', () => {
  const now = new Date('2026-08-13T12:00:00Z');
  const subscribed = candidate({ videoId: 'subscribed', channelId: 'subscribed-channel' });
  const unsubscribed = candidate({ videoId: 'unsubscribed', channelId: 'other-channel', subscribed: false });
  assert.ok(rankScore(subscribed, now, HOME_RANKING_POLICY) > rankScore(unsubscribed, now, HOME_RANKING_POLICY));
});

test('uneven scores cannot exhaust channel diversity before the final full group', () => {
  // Seed 259 exhausted all but four channels before the old greedy feed's final group.
  for (let seed = 259; seed < 279; seed += 1) {
    let state = seed;
    const items = Array.from({ length: 11 }, (_, channel) =>
      Array.from({ length: 4 }, (_, index) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return candidate({
          videoId: `${channel}-${index}`, channelId: `channel-${channel}`,
          refreshPenalty: state / 4294967296
        });
      })
    ).flat();
    const byId = new Map(items.map((item) => [item.videoId, item.channelId]));
    const selected = selectRankedFeed(items, 40, HOME_RANKING_POLICY);
    assert.equal(selected.length, 40);
    for (let start = 0; start < selected.length; start += 5) {
      assert.equal(new Set(selected.slice(start, start + 5).map((id) => byId.get(id))).size, 5, `seed ${seed}, group ${start / 5}`);
    }
  }
});

test('sparse subscriptions produce a shorter feed without filling from unsubscribed channels', () => {
  const subscribed = Array.from({ length: 2 }, (_, index) => candidate({
    videoId: `subscribed-${index}`, channelId: `subscribed-channel-${index}`
  }));
  const unsubscribed = Array.from({ length: 12 }, (_, index) => candidate({
    videoId: `unsubscribed-${index}`, channelId: `other-channel-${index}`, subscribed: false
  }));
  const selected = selectRankedFeed([...subscribed, ...unsubscribed], 10, HOME_RANKING_POLICY, new Date('2026-08-13T12:00:00Z'));
  assert.deepEqual(selected, ['subscribed-0', 'subscribed-1']);
});

test('a channel shortage uses every available channel before repeats and respects exhaustion', () => {
  const items = [
    ...Array.from({ length: 7 }, (_, index) => candidate({ videoId: `a${index}`, channelId: 'a' })),
    ...Array.from({ length: 2 }, (_, index) => candidate({ videoId: `b${index}`, channelId: 'b' })),
    candidate({ videoId: 'c0', channelId: 'c' })
  ];
  assert.deepEqual(selectRankedFeed(items, 40, HOME_RANKING_POLICY), ['a0', 'b0', 'c0', 'a1', 'b1', 'a2', 'a3']);
});

test('shortage passes reset at fixed five-video boundaries', () => {
  const items = ['a', 'b', 'c', 'd'].flatMap((channelId) =>
    Array.from({ length: 4 }, (_, index) => candidate({ videoId: `${channelId}${index}`, channelId }))
  );
  assert.deepEqual(selectRankedFeed(items, 10, HOME_RANKING_POLICY), [
    'a0', 'b0', 'c0', 'd0', 'a1',
    'a2', 'b1', 'c1', 'd1', 'a3'
  ]);
});

test('ties are deterministic across input order, duplicate candidates, and partial groups', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].flatMap((channelId) =>
    Array.from({ length: 2 }, (_, index) => candidate({ videoId: `${channelId}${index}`, channelId }))
  );
  const expected = ['a0', 'b0', 'c0', 'd0', 'e0', 'a1', 'b1'];
  assert.deepEqual(selectRankedFeed([...items, items[0]], 7, HOME_RANKING_POLICY), expected);
  assert.deepEqual(selectRankedFeed([...items].reverse(), 7, HOME_RANKING_POLICY), expected);
  assert.deepEqual(selectRankedFeed(items, 3, HOME_RANKING_POLICY), expected.slice(0, 3));
  assert.deepEqual(selectRankedFeed(items, 0, HOME_RANKING_POLICY), []);
  assert.deepEqual(selectRankedFeed([], 40, HOME_RANKING_POLICY), []);
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
  const initial = selectRankedFeed(videos, 6, DEFAULT_RANKING_POLICY, now);
  assert.equal(initial[0], 'v0');
  assert.equal(initial[1], 'v1');
  const punished = videos.map((video) =>
    video.videoId === 'v0' || video.videoId === 'v1'
      ? { ...video, refreshPenalty: REFRESH_PENALTY }
      : video
  );
  const refreshed = selectRankedFeed(punished, 6, DEFAULT_RANKING_POLICY, now);
  assert.equal(refreshed[0], 'v2');
  assert.equal(refreshed[1], 'v3');
  assert.ok(refreshed.indexOf('v0') > refreshed.indexOf('v2'));
});

test('playback becomes watched at eighty percent', () => {
  assert.equal(playbackState(79, 100).state, 'in_progress');
  assert.equal(playbackState(80, 100).state, 'watched');
});

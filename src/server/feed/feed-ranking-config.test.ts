import assert from 'node:assert/strict';
import test from 'node:test';
import { readHomeRankingPolicy } from './feed-ranking-config';

test('Home ranking config defaults to five-channel groups and a 0.20 subscription bonus', () => {
  const policy = readHomeRankingPolicy({});
  assert.equal(policy.channelGroupSize, 5);
  assert.equal(policy.subscribedBonus, 0.2);
  assert.equal(policy.perChannelLimit, 4);
});

test('Home ranking config honors valid environment overrides', () => {
  const policy = readHomeRankingPolicy({
    HOMETUBE_HOME_SUBSCRIBED_BONUS: '0.4'
  });
  assert.equal(policy.channelGroupSize, 5);
  assert.equal(policy.subscribedBonus, 0.4);
});

test('Home ranking config falls back for invalid environment values', () => {
  const policy = readHomeRankingPolicy({
    HOMETUBE_HOME_SUBSCRIBED_BONUS: 'not-a-number'
  });
  assert.equal(policy.channelGroupSize, 5);
  assert.equal(policy.subscribedBonus, 0.2);
});

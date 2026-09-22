import assert from 'node:assert/strict';
import test from 'node:test';
import { readHomeRankingPolicy } from './feed-ranking-config';

test('Home ranking config defaults to a 90/10 trial mix and a 0.20 subscription bonus', () => {
  const policy = readHomeRankingPolicy({});
  assert.equal(policy.trialShare, 0.1);
  assert.equal(policy.subscribedBonus, 0.2);
  assert.equal(policy.perChannelLimit, 4);
});

test('Home ranking config honors valid environment overrides', () => {
  const policy = readHomeRankingPolicy({
    HOMETUBE_HOME_TRIAL_SHARE: '0.25',
    HOMETUBE_HOME_SUBSCRIBED_BONUS: '0.4'
  });
  assert.equal(policy.trialShare, 0.25);
  assert.equal(policy.subscribedBonus, 0.4);
});

test('Home ranking config falls back for invalid environment values', () => {
  const policy = readHomeRankingPolicy({
    HOMETUBE_HOME_TRIAL_SHARE: '-0.1',
    HOMETUBE_HOME_SUBSCRIBED_BONUS: 'not-a-number'
  });
  assert.equal(policy.trialShare, 0.1);
  assert.equal(policy.subscribedBonus, 0.2);
});

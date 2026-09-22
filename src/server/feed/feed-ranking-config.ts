import { HOME_RANKING_POLICY, type RankingPolicy } from '@/domain/feed-ranking';

export function readHomeRankingPolicy(env: Record<string, string | undefined> = process.env): RankingPolicy {
  return {
    ...HOME_RANKING_POLICY,
    trialShare: boundedFraction(env.HOMETUBE_HOME_TRIAL_SHARE, HOME_RANKING_POLICY.trialShare),
    subscribedBonus: boundedFraction(env.HOMETUBE_HOME_SUBSCRIBED_BONUS, HOME_RANKING_POLICY.subscribedBonus)
  };
}

function boundedFraction(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

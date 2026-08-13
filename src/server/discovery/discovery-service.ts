import { normalizeYouTubeChannelUrl } from '@/domain/youtube-url';
import {
  createAiTrialChannel, hasKnownChannel, listDiscoveryContextChannels, listKnownChannelUrls
} from '@/server/channels/channel-repository';
import { enqueueChannelImport } from '@/server/jobs/job-repository';
import { validateChannelUrl } from '@/server/youtube/yt-dlp-adapter';
import { completeDiscoveryRun, failDiscoveryRun, recordDiscoveryCandidate, startDiscoveryRun } from './discovery-repository';
import { recommendChannels } from './openrouter-adapter';

const TARGET_COUNT = 5;

export async function runChannelDiscovery(): Promise<number> {
  const runId = await startDiscoveryRun(TARGET_COUNT);
  let model: string | null = null;
  try {
    const [context, initialExcluded] = await Promise.all([
      listDiscoveryContextChannels(10),
      listKnownChannelUrls()
    ]);
    if (context.length === 0) {
      await completeDiscoveryRun(runId, null);
      return 0;
    }
    const excluded = new Set(initialExcluded.map((url) => url.toLowerCase().replace(/\/$/, '')));
    let accepted = 0;
    for (let attempt = 0; attempt < 3 && accepted < TARGET_COUNT; attempt += 1) {
      const result = await recommendChannels(context, [...excluded], TARGET_COUNT - accepted);
      model = result.model;
      for (const candidate of result.candidates) {
        let sourceUrl: string;
        try {
          sourceUrl = normalizeYouTubeChannelUrl(candidate.url);
        } catch {
          await recordDiscoveryCandidate({ runId, name: candidate.name, sourceUrl: candidate.url, reason: candidate.reason, status: 'invalid' });
          continue;
        }
        const key = sourceUrl.toLowerCase();
        if (excluded.has(key)) {
          await recordDiscoveryCandidate({ runId, name: candidate.name, sourceUrl, reason: candidate.reason, status: 'duplicate' });
          continue;
        }
        excluded.add(key);
        try {
          const validated = await validateChannelUrl(sourceUrl);
          if (await hasKnownChannel(sourceUrl, validated.youtubeChannelId)) {
            await recordDiscoveryCandidate({ runId, name: validated.name, sourceUrl, reason: candidate.reason, status: 'duplicate' });
            continue;
          }
          const channel = await createAiTrialChannel(sourceUrl, validated.youtubeChannelId, validated.name, candidate.reason);
          if (!channel) {
            await recordDiscoveryCandidate({ runId, name: validated.name, sourceUrl, reason: candidate.reason, status: 'duplicate' });
            continue;
          }
          await recordDiscoveryCandidate({
            runId, name: channel.name, sourceUrl, reason: candidate.reason, status: 'accepted', channelId: channel.id
          });
          await enqueueChannelImport(channel.id);
          accepted += 1;
          if (accepted >= TARGET_COUNT) break;
        } catch {
          await recordDiscoveryCandidate({ runId, name: candidate.name, sourceUrl, reason: candidate.reason, status: 'invalid' });
        }
      }
    }
    await completeDiscoveryRun(runId, model);
    return accepted;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown discovery error';
    await failDiscoveryRun(runId, model, message);
    throw error;
  }
}

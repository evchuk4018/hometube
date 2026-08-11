import { appConfig, hasDatabase } from "../config";
import { createDiscovery, completeDiscovery, failDiscovery, lastDiscoveryAt, listRejectedProviderIds, recordChannelEvaluation } from "../repositories/discovery-repository";
import { createChannel, findChannelByProviderId, listDiscoveryChannels, startChannelTrial } from "../repositories/channel-repository";
import { listVideosByChannel, upsertVideo } from "../repositories/video-repository";
import { buildTrialPool } from "@/domain/trial";
import { YtDlpProvider } from "../providers/ytdlp-provider";

type Proposal = { providerId: string; name: string; justification: string };

function parseProposals(content: string): Proposal[] {
  try {
    const parsed = JSON.parse(content) as { channels?: Proposal[] } | Proposal[];
    const list = Array.isArray(parsed) ? parsed : parsed.channels ?? [];
    return list.filter((entry) => entry && typeof entry.providerId === "string" && typeof entry.name === "string").slice(0, appConfig.discoveryChannelCount);
  } catch {
    return [];
  }
}

export async function runChannelDiscovery(): Promise<void> {
  if (!hasDatabase() || !appConfig.openRouterApiKey) return;
  const last = await lastDiscoveryAt();
  if (last && Date.now() - last.getTime() < appConfig.discoveryCadenceHours * 3_600_000) return;
  const strongest = await listDiscoveryChannels(appConfig.discoveryChannelCount);
  const rejectedProviderIds = await listRejectedProviderIds();
  const context = { strongestChannels: strongest.map((channel) => ({ name: channel.name, providerId: channel.providerId, averagePercentageWatched: channel.averagePercentageWatched, videosWatched: channel.videosWatched, recentEngagement: channel.recentEngagement })), rejectedProviderIds };
  const discoveryId = await createDiscovery({ model: appConfig.openRouterModel, context });
  try {
    const response = await fetch(`${appConfig.openRouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${appConfig.openRouterApiKey}` },
      body: JSON.stringify({
        model: appConfig.openRouterModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Suggest YouTube channels only. Return JSON {channels:[{providerId,name,justification}]}. Do not suggest any channel in the supplied context." },
          { role: "user", content: JSON.stringify({ ...context, count: appConfig.discoveryChannelCount }) }
        ]
      })
    });
    if (!response.ok) throw new Error(`OpenRouter returned ${response.status}.`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const proposals = parseProposals(payload.choices?.[0]?.message?.content ?? "{}");
    await completeDiscovery(discoveryId, proposals);
    const provider = new YtDlpProvider();
    for (const proposal of proposals) {
      if (rejectedProviderIds.includes(proposal.providerId)) continue;
      const existing = await findChannelByProviderId(proposal.providerId);
      if (existing?.rejectionCount) continue;
      const channel = existing ?? await createChannel({ providerId: proposal.providerId, name: proposal.name, source: "ai_recommendation" });
      if (!existing) {
        const videos = await provider.listChannelVideos(proposal.providerId);
        const ids = buildTrialPool(videos, new Set(), appConfig.trialPoolSize);
        for (const item of videos) {
          const video = await upsertVideo(channel.id, item);
          await recordChannelEvaluation({ channelId: channel.id, discoveryId, justification: proposal.justification, outcome: ids.includes(item.providerId) ? "trial" : "candidate" });
          if (ids.includes(item.providerId)) await import("../repositories/video-repository").then(({ setVideoTrial }) => setVideoTrial(video.id, true));
        }
        await startChannelTrial(channel.id, new Date(Date.now() + appConfig.trialDays * 86_400_000));
      }
    }
  } catch (error) {
    await failDiscovery(discoveryId, error instanceof Error ? error.message : "Discovery failed.");
    throw error;
  }
}

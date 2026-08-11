import { appConfig, hasDatabase } from "@/server/config";
import { YtDlpProvider } from "@/server/providers/ytdlp-provider";
import { cleanupCache, processOneDownload } from "@/server/services/download-service";
import { runChannelDiscovery } from "@/server/services/discovery-service";
import { syncAllCatalog, syncPodcastCatalog, shouldRunCatalogSync, evaluateTrials, queueNormalRecommendations } from "@/server/services/sync-service";

async function runCycle(provider: YtDlpProvider, state: { lastCatalogSync: number | null }): Promise<void> {
  if (!hasDatabase()) {
    console.warn("Worker is waiting for DATABASE_URL.");
    return;
  }
  for (let count = 0; count < 3; count += 1) {
    if (!(await processOneDownload(provider))) break;
  }
  if (shouldRunCatalogSync(state.lastCatalogSync)) {
    await syncAllCatalog(provider);
    state.lastCatalogSync = Date.now();
  } else {
    await syncPodcastCatalog(provider);
  }
  await evaluateTrials();
  await queueNormalRecommendations();
  for (let count = 0; count < 3; count += 1) {
    if (!(await processOneDownload(provider))) break;
  }
  await cleanupCache();
  await runChannelDiscovery();
}

async function main(): Promise<void> {
  const provider = new YtDlpProvider();
  const state = { lastCatalogSync: null as number | null };
  let cycleRunning = false;
  const cycle = async () => {
    if (cycleRunning) return;
    cycleRunning = true;
    try {
      await runCycle(provider, state);
    } catch (error) {
      console.error("HomeTube worker cycle failed.", error);
    } finally {
      cycleRunning = false;
    }
  };
  await cycle();
  setInterval(() => void cycle(), appConfig.workerIntervalSeconds * 1000);
}

void main();

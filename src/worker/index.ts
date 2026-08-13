import { createServer } from 'node:http';
import os from 'node:os';
import { pool } from '@/server/db/client';
import { claimNextJob, failJob, scheduleDueJobs } from '@/server/jobs/job-repository';
import { handleJob, reflectJobFailure } from './job-handlers';

const workerId = `${os.hostname()}:${process.pid}`;
const pollMs = Number(process.env.WORKER_POLL_MS ?? 1500);
const port = Number(process.env.WORKER_PORT ?? 4000);
let stopping = false;
let activeJobId: string | null = null;
let lastMaintenanceAt = 0;
let databaseHealthy = false;

const server = createServer((request, response) => {
  if (request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(databaseHealthy ? 200 : 503, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: databaseHealthy ? 'healthy' : 'unhealthy', workerId, activeJobId }));
});

server.listen(port, '0.0.0.0', () => console.log(`HomeTube worker ${workerId} listening on ${port}`));

async function loop(): Promise<void> {
  while (!stopping) {
    if (Date.now() - lastMaintenanceAt >= 60_000) {
      lastMaintenanceAt = Date.now();
      await scheduleDueJobs()
        .then(() => { databaseHealthy = true; })
        .catch((error) => {
          databaseHealthy = false;
          console.error('Unable to schedule maintenance', error);
        });
    }
    const job = await claimNextJob(workerId)
      .then((claimed) => {
        databaseHealthy = true;
        return claimed;
      })
      .catch((error) => {
        databaseHealthy = false;
        console.error('Unable to claim a job', error);
        return null;
      });
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }
    activeJobId = job.id;
    try {
      await handleJob(job);
    } catch (error) {
      const message = safeMessage(error);
      console.error(`Job ${job.id} failed: ${message}`);
      await reflectJobFailure(job, message).catch(console.error);
      await failJob(job, message).catch(console.error);
    } finally {
      activeJobId = null;
    }
  }
}

function safeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unknown worker error';
  return raw.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 500);
}

async function shutdown(): Promise<void> {
  stopping = true;
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
void loop();

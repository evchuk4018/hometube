import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '@/server/db/client';
import type { ClaimedJob } from '@/server/jobs/job-repository';
import { handleJob, reflectJobFailure } from './job-handlers';

function job(overrides: Partial<ClaimedJob>): ClaimedJob {
  return {
    id: 'e409467c-b492-4829-a0b1-679b04ac8f76',
    type: 'download_video',
    status: 'running',
    progress: 0,
    stage: 'Starting download',
    error: null,
    channelId: null,
    videoId: null,
    attemptCount: 1,
    ...overrides
  };
}

test('legacy discovery and unknown jobs are rejected before touching channel or media state', async (t) => {
  for (const type of ['discover_channels', 'unknown']) {
    await t.test(type, async (child) => {
      const query = child.mock.method(pool, 'query', (async () => {
        throw new Error('Unexpected database side effect');
      }) as unknown as typeof pool.query);
      const legacy = job({
        type: type as ClaimedJob['type'],
        channelId: '69344f99-b742-43dc-bb43-080650c098cc',
        videoId: 'abcdefghijk'
      });

      await assert.rejects(handleJob(legacy), { message: `Unsupported job type: ${type}` });
      await reflectJobFailure(legacy, 'Unsupported job type');

      assert.equal(query.mock.callCount(), 0);
    });
  }
});

test('supported jobs retain their distinct input validation', async () => {
  await assert.rejects(handleJob(job({ type: 'import_channel' })), { message: 'Import job has no channel.' });
  await assert.rejects(handleJob(job({ type: 'download_video' })), { message: 'Download job has no video.' });
});

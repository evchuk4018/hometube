import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { pool } from '@/server/db/client';
import { claimNextJob, getJob, scheduleDueJobs } from './job-repository';

type RecordedQuery = { sql: string; values: unknown[] };

function result(rows: unknown[] = []) {
  return { rows, rowCount: rows.length, fields: [], command: 'SELECT', oid: 0 };
}

function mockPoolQuery(t: TestContext, rows: unknown[] = []): RecordedQuery[] {
  const queries: RecordedQuery[] = [];
  t.mock.method(pool, 'query', (async (sql: string, values: unknown[] = []) => {
    queries.push({ sql, values });
    return result(rows);
  }) as unknown as typeof pool.query);
  return queries;
}

function mockTransaction(t: TestContext, respond: (sql: string) => unknown[] = () => []) {
  const queries: RecordedQuery[] = [];
  const release = t.mock.fn();
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      return result(respond(sql));
    },
    release
  };
  t.mock.method(pool, 'connect', (async () => client) as unknown as typeof pool.connect);
  return { queries, release };
}

function setEnvironment(t: TestContext, key: string, value: string | undefined) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

test('maintenance schedules subscription imports without trials or discovery even with legacy settings', async (t) => {
  setEnvironment(t, 'CHANNEL_REFRESH_SUBSCRIBED_MS', undefined);
  setEnvironment(t, 'CHANNEL_REFRESH_TRIAL_MS', '1');
  setEnvironment(t, 'CHANNEL_DISCOVERY_INTERVAL_MS', '1');
  setEnvironment(t, 'CHANNEL_DISCOVERY_RETRY_MS', '1');
  const queries = mockPoolQuery(t);

  await scheduleDueJobs(new Date('2026-10-08T12:00:00Z'));

  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /INSERT INTO jobs/);
  assert.match(queries[0].sql, /SELECT gen_random_uuid\(\), 'import_channel', c\.id/);
  assert.match(queries[0].sql, /WHERE c\.is_subscribed = true\s+AND COALESCE\(c\.last_imported_at, '-infinity'\) < \$1::timestamptz/);
  assert.doesNotMatch(queries[0].sql, /trial_status|discovery|discover_channels/i);
  assert.deepEqual(queries[0].values, [new Date('2026-10-08T06:00:00Z')]);
});

test('subscription refresh retains its configurable cadence and safe default', async (t) => {
  const cases = [
    { value: '3600000', cutoff: '2026-10-08T11:00:00Z' },
    { value: '0', cutoff: '2026-10-08T06:00:00Z' },
    { value: '-1', cutoff: '2026-10-08T06:00:00Z' },
    { value: 'invalid', cutoff: '2026-10-08T06:00:00Z' }
  ];
  for (const scenario of cases) {
    await t.test(`interval ${scenario.value}`, async (child) => {
      setEnvironment(child, 'CHANNEL_REFRESH_SUBSCRIBED_MS', scenario.value);
      const queries = mockPoolQuery(child);
      await scheduleDueJobs(new Date('2026-10-08T12:00:00Z'));
      assert.deepEqual(queries[0].values, [new Date(scenario.cutoff)]);
    });
  }
});

test('claims exclude legacy discovery jobs and commit when there is no supported work', async (t) => {
  const { queries, release } = mockTransaction(t);

  assert.equal(await claimNextJob('worker:test'), null);

  assert.equal(queries[0].sql, 'BEGIN');
  const selection = queries[1].sql;
  assert.match(selection, /WHERE type IN \('import_channel', 'download_video'\) AND/);
  assert.doesNotMatch(selection, /discover_channels/);
  assert.match(selection, /FOR UPDATE SKIP LOCKED/);
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
  assert.equal(queries.length, 3);
  assert.equal(release.mock.callCount(), 1);
});

test('supported claims still prioritize downloads, recover leases, and acquire a new lease', async (t) => {
  const row = {
    id: 'e409467c-b492-4829-a0b1-679b04ac8f76',
    type: 'download_video',
    status: 'queued',
    progress: '0',
    stage: 'Queued',
    error: null,
    channel_id: '69344f99-b742-43dc-bb43-080650c098cc',
    video_id: 'abcdefghijk',
    attempt_count: 1
  };
  const { queries, release } = mockTransaction(t, (sql) => {
    if (sql.trim().startsWith('SELECT')) return [row];
    if (sql.trim().startsWith('UPDATE')) {
      return [{ ...row, status: 'running', stage: 'Starting download', attempt_count: 2 }];
    }
    return [];
  });

  const claimed = await claimNextJob('worker:test');

  assert.equal(claimed?.type, 'download_video');
  assert.equal(claimed?.videoId, row.video_id);
  assert.equal(claimed?.attemptCount, 2);
  assert.equal(claimed?.status, 'running');
  assert.match(queries[1].sql, /ORDER BY CASE type WHEN 'download_video' THEN 0 ELSE 1 END/);
  assert.match(queries[1].sql, /status = 'queued' AND attempt_count < 3/);
  assert.match(queries[1].sql, /status = 'running' AND \(lease_expires_at IS NULL OR lease_expires_at < now\(\)\)/);
  assert.match(queries[2].sql, /lease_owner = \$2, lease_expires_at = now\(\) \+ interval '5 minutes'/);
  assert.deepEqual(queries[2].values, [row.id, 'worker:test']);
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('retired discovery job history remains readable', async (t) => {
  const row = {
    id: 'e409467c-b492-4829-a0b1-679b04ac8f76',
    type: 'discover_channels',
    status: 'failed',
    progress: '10',
    stage: 'AI discovery disabled',
    error: 'AI discovery disabled',
    channel_id: null,
    video_id: null,
    attempt_count: 1
  };
  mockPoolQuery(t, [row]);

  const job = await getJob(row.id);

  assert.equal(job?.type, 'discover_channels');
  assert.equal(job?.status, 'failed');
  assert.equal(job?.progress, 10);
  assert.equal(job?.stage, 'AI discovery disabled');
});

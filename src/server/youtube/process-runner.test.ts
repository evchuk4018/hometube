import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { runProcess } from './process-runner';

test('allows a stdout consumer to stop a long-running process', async () => {
  let callbacks = 0;
  const result = await runProcess(process.execPath, [
    '-e',
    "console.log('first'); setTimeout(() => console.log('second'), 5000);"
  ], {
    onStdoutLine: () => {
      callbacks += 1;
      return true;
    }
  });

  assert.equal(callbacks, 1);
  assert.match(result.stdout, /first/);
});

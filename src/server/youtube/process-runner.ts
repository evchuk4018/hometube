import { spawn } from 'node:child_process';
import readline from 'node:readline';

export type ProcessResult = { stdout: string; stderr: string };

export async function runProcess(
  command: string,
  args: string[],
  options: {
    onStdoutLine?: (line: string) => void | boolean | Promise<void | boolean>;
    onStderrLine?: (line: string) => void | Promise<void>;
    timeoutMs?: number;
  } = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let callbackQueue = Promise.resolve();
    let stopRequested = false;
    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let killHandle: NodeJS.Timeout | null = null;

    const clearTimers = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killHandle) clearTimeout(killHandle);
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (stopRequested) return;
        timedOut = true;
        stopRequested = true;
        child.kill('SIGTERM');
        killHandle = setTimeout(() => {
          try { child.kill('SIGKILL'); } catch { /* already exited */ }
        }, 5000);
        if (killHandle && (killHandle as unknown as { unref?: () => void }).unref) {
          (killHandle as unknown as { unref: () => void }).unref();
        }
      }, options.timeoutMs);
      if ((timeoutHandle as unknown as { unref?: () => void }).unref) {
        (timeoutHandle as unknown as { unref: () => void }).unref();
      }
    }

    const stdoutLines = readline.createInterface({ input: child.stdout });
    const stderrLines = readline.createInterface({ input: child.stderr });
    stdoutLines.on('line', (line) => {
      stdout += `${line}\n`;
      if (options.onStdoutLine) {
        callbackQueue = callbackQueue.then(async () => {
          if (stopRequested) return;
          const shouldStop = await options.onStdoutLine?.(line);
          if (shouldStop && !stopRequested) {
            stopRequested = true;
            clearTimers();
            child.kill('SIGTERM');
          }
        });
      }
    });
    stderrLines.on('line', (line) => {
      stderr += `${line}\n`;
      if (options.onStderrLine) callbackQueue = callbackQueue.then(() => options.onStderrLine?.(line));
    });

    child.once('error', (error) => {
      clearTimers();
      reject(error);
    });
    child.once('close', (code) => {
      clearTimers();
      void callbackQueue.then(() => {
        if (timedOut) {
          reject(new Error(`${command} timed out after ${options.timeoutMs}ms: ${lastUsefulLine(stderr) || lastUsefulLine(stdout)}`));
          return;
        }
        if (code === 0 || stopRequested) resolve({ stdout, stderr });
        else reject(new Error(`${command} exited with code ${code}: ${lastUsefulLine(stderr)}`));
      }).catch(reject);
    });
  });
}

function lastUsefulLine(value: string): string {
  const line = value.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? 'Unknown process error';
  return line.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 500);
}

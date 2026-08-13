import { spawn } from 'node:child_process';
import readline from 'node:readline';

export type ProcessResult = { stdout: string; stderr: string };

export async function runProcess(
  command: string,
  args: string[],
  options: {
    onStdoutLine?: (line: string) => void | Promise<void>;
    onStderrLine?: (line: string) => void | Promise<void>;
  } = {}
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let callbackQueue = Promise.resolve();

    const stdoutLines = readline.createInterface({ input: child.stdout });
    const stderrLines = readline.createInterface({ input: child.stderr });
    stdoutLines.on('line', (line) => {
      stdout += `${line}\n`;
      if (options.onStdoutLine) callbackQueue = callbackQueue.then(() => options.onStdoutLine?.(line));
    });
    stderrLines.on('line', (line) => {
      stderr += `${line}\n`;
      if (options.onStderrLine) callbackQueue = callbackQueue.then(() => options.onStderrLine?.(line));
    });

    child.once('error', reject);
    child.once('close', (code) => {
      void callbackQueue.then(() => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${command} exited with code ${code}: ${lastUsefulLine(stderr)}`));
      }).catch(reject);
    });
  });
}

function lastUsefulLine(value: string): string {
  const line = value.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? 'Unknown process error';
  return line.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 500);
}


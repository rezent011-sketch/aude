import { spawn } from 'child_process';
import os from 'os';

const EXECUTION_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_LENGTH = 2000;
const TRUNCATED_SUFFIX = '...[truncated]';

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

interface RuntimeConfig {
  command: string;
  args: string[];
}

function getRuntimeConfig(language: string): RuntimeConfig {
  switch (language) {
    case 'python3':
      return { command: 'python3', args: ['-I', '-'] };
    case 'node':
      return { command: 'node', args: ['-'] };
    case 'bash':
      return { command: 'bash', args: ['--noprofile', '--norc', '-s'] };
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

function appendChunk(current: string, chunk: string): string {
  if (current.length >= MAX_OUTPUT_LENGTH + TRUNCATED_SUFFIX.length) {
    return current;
  }

  return current + chunk;
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }

  return output.slice(0, MAX_OUTPUT_LENGTH - TRUNCATED_SUFFIX.length) + TRUNCATED_SUFFIX;
}

function buildExecutionEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '',
    HOME: os.tmpdir(),
    TMPDIR: os.tmpdir(),
    TEMP: os.tmpdir(),
    TMP: os.tmpdir(),
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NO_PROXY: '*',
    no_proxy: '*',
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    ALL_PROXY: '',
    http_proxy: '',
    https_proxy: '',
    all_proxy: '',
    NODE_OPTIONS: '',
    PYTHONPATH: '',
    PYTHONHOME: '',
    npm_config_proxy: '',
    npm_config_https_proxy: '',
    npm_config_registry: '',
  };
}

export async function executeCode(language: string, code: string): Promise<CodeExecutionResult> {
  const runtime = getRuntimeConfig(language);

  return new Promise<CodeExecutionResult>((resolve, reject) => {
    const child = spawn(runtime.command, runtime.args, {
      cwd: os.tmpdir(),
      env: buildExecutionEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, EXECUTION_TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = appendChunk(stdout, chunk);
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr = appendChunk(stderr, chunk);
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      resolve({
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exitCode: code ?? (signal ? -1 : 0),
        timedOut,
      });
    });

    child.stdin.end(code);
  });
}

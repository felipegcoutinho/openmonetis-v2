import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";

const maximumOutputBytes = 2 * 1024 * 1024;
const forcedStopDelayMs = 5_000;

export type ProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** The caller stopped the command through its abort signal. */
  aborted: boolean;
};

export type CommandOptions = {
  cwd?: string;
  env: Record<string, string>;
  input?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Receives each stdout line as it arrives, for CLIs that stream their answer. */
  onStdoutLine?: (line: string) => void;
};

/** Runs a CLI to completion with a deadline and a bounded output buffer. */
export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "pipe" });
    const stdout = collectOutput(child.stdout);
    const stderr = collectOutput(child.stderr);
    if (options.onStdoutLine) {
      createInterface({ input: child.stdout }).on("line", options.onStdoutLine);
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopProcess(child);
    }, options.timeoutMs);
    const abort = () => stopProcess(child);
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      resolve({
        exitCode,
        stdout: stdout.text(),
        stderr: stderr.text(),
        timedOut,
        aborted: options.signal?.aborted ?? false,
      });
    };
    child.on("error", () => finish(null));
    child.on("close", finish);

    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input ?? "");
  });
}

/** Starts a long-lived interactive CLI (a sign-in) whose output is read as it arrives. */
export function startInteractiveCommand(
  command: string,
  args: string[],
  options: Omit<CommandOptions, "input" | "timeoutMs">,
) {
  const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: "pipe" });
  child.stdin.on("error", () => undefined);
  return child;
}

export function stopProcess(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, forcedStopDelayMs).unref();
}

export function collectOutput(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  let size = 0;
  stream.on("data", (chunk: Buffer) => {
    if (size >= maximumOutputBytes) return;
    chunks.push(chunk);
    size += chunk.length;
  });
  return { text: () => Buffer.concat(chunks).toString("utf8").slice(0, maximumOutputBytes) };
}

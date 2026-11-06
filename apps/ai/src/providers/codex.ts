import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { aiProviderLoginMethodByProvider } from "@openmonetis/domain/ai-providers";
import { createCliEnvironment } from "../utils/env";
import { runCommand, startInteractiveCommand, stopProcess } from "../utils/process";
import {
  accountEmailOf,
  type ChatEvent,
  type ChatInput,
  type ChatResult,
  type CommandSource,
  classifyRunFailure,
  commandOf,
  type LoginPrompt,
  type ProviderAdapter,
  type ProviderModel,
} from "./provider";

const statusTimeoutMs = 15_000;
const runTimeoutMs = 180_000;
const appServerTimeoutMs = 15_000;
const chatTimeoutMs = 180_000;
const verificationUrlPattern = /https:\/\/auth\.openai\.com\/\S+/;
const userCodePattern = /\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b/;
const terminalColorPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * The ChatGPT sign-in is forced so an API key can never be used silently, and credentials are
 * kept as a file inside the user's `CODEX_HOME` instead of a shared system keyring. Analytics
 * (and the metrics exporter that follows it) and feedback submission stay off.
 */
export const subscriptionConfig = [
  "-c",
  'forced_login_method="chatgpt"',
  "-c",
  'cli_auth_credentials_store="file"',
  "-c",
  "analytics.enabled=false",
  "-c",
  "feedback.enabled=false",
];

/**
 * Generations answer only from the prompt: every built-in tool that could read files, run
 * commands, browse or call other services is turned off. Every provider home shares one OS user,
 * so a tool would reach other people's sign-ins; the stream guard below stops any that remains.
 */
export const toolsOffConfig = [
  ...[
    "shell_tool",
    "unified_exec",
    "view_image",
    "apps",
    "plugins",
    "browser_use",
    "computer_use",
    "in_app_browser",
    "multi_agent",
    "image_generation",
    "hooks",
    "code_mode_host",
  ].flatMap((feature) => ["-c", `features.${feature}=false`]),
  "-c",
  'web_search="disabled"',
];

/** Thread items of an app-server turn that never read, run or fetch anything. */
const safeChatItemTypes = new Set([
  "userMessage",
  "agentMessage",
  "reasoning",
  "plan",
  "contextCompaction",
]);

/** Items of a `codex exec --json` run that never read, run or fetch anything. */
const safeRunItemTypes = new Set(["agent_message", "reasoning", "todo_list", "error"]);

/** Codex CLI, run as published with the person's own ChatGPT plan. */
export function createCodexProvider(cli: CommandSource = "codex"): ProviderAdapter {
  const environment = (home: string) => createCliEnvironment({ CODEX_HOME: home });

  return {
    provider: "codex",
    loginMethod: aiProviderLoginMethodByProvider.codex,

    async readAccount(home) {
      const result = await runCommand(commandOf(cli), [...subscriptionConfig, "login", "status"], {
        env: environment(home),
        timeoutMs: statusTimeoutMs,
      });
      if (result.exitCode !== 0 || !/chatgpt/i.test(`${result.stdout}${result.stderr}`)) {
        return null;
      }
      const account = await requestCodexAppServer(commandOf(cli), home, environment(home), {
        method: "account/read",
        params: { refreshToken: false },
      });
      return { email: parseCodexAccountEmail(account) };
    },

    loginCommand(home) {
      return {
        command: commandOf(cli),
        args: [...subscriptionConfig, "login", "--device-auth"],
        env: environment(home),
      };
    },

    parseLoginPrompt: parseCodexLoginPrompt,

    async logout(home) {
      await runCommand(commandOf(cli), [...subscriptionConfig, "logout"], {
        env: environment(home),
        timeoutMs: statusTimeoutMs,
      });
    },

    listModels(home) {
      return readCodexModels(commandOf(cli), home, environment(home));
    },

    async chat(home, input, emit) {
      return runCodexChat(commandOf(cli), environment(home), input, emit);
    },

    async run(home, input) {
      const models = await readCodexModels(commandOf(cli), home, environment(home));
      const model = input.model
        ? (models.find((item) => item.id === input.model) ?? { id: input.model, name: input.model })
        : (models.find((item) => item.isDefault) ?? null);
      const schemaPath = path.join(input.workDirectory, "output-schema.json");
      const outputPath = path.join(input.workDirectory, "output.json");
      const sandboxDirectory = path.join(input.workDirectory, "workspace");
      await mkdir(sandboxDirectory);
      await writeFile(schemaPath, JSON.stringify(input.schema), { mode: 0o600 });

      const guard = new AbortController();
      let unsafeTool = false;
      const result = await runCommand(
        commandOf(cli),
        [
          "exec",
          ...subscriptionConfig,
          ...toolsOffConfig,
          ...(model ? ["--model", model.id] : []),
          "--json",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--ephemeral",
          "--ignore-user-config",
          "--cd",
          sandboxDirectory,
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
          "-",
        ],
        {
          cwd: sandboxDirectory,
          env: environment(home),
          input: `${input.instructions}\n\n${input.prompt}`,
          timeoutMs: runTimeoutMs,
          signal: input.signal ? AbortSignal.any([input.signal, guard.signal]) : guard.signal,
          onStdoutLine: (line) => {
            if (unsafeTool || !isUnsafeRunEvent(parseJsonLine(line))) return;
            // The answer must never come from an agent that reads or runs anything.
            unsafeTool = true;
            guard.abort();
          },
        },
      );
      if (unsafeTool) return { status: "failed", code: "runFailed" };
      if (result.exitCode !== 0) return { status: "failed", code: classifyRunFailure(result) };

      try {
        return {
          status: "completed",
          output: JSON.parse(await readFile(outputPath, "utf8")),
          model: model ? { id: model.id, name: model.name } : null,
        };
      } catch {
        return { status: "failed", code: "invalidOutput" };
      }
    },
  };
}

/**
 * A chat turn through the Codex app server, which streams the answer as it is written. The thread
 * is ephemeral, read-only, without tools and never asks for approvals; any request from the server
 * is refused, and a turn that starts any item other than messages or reasoning is stopped.
 */
function runCodexChat(
  command: string,
  env: Record<string, string>,
  input: ChatInput,
  emit: (event: ChatEvent) => void,
): Promise<ChatResult> {
  return new Promise((resolve) => {
    const child = startInteractiveCommand(
      command,
      [...subscriptionConfig, ...toolsOffConfig, "app-server"],
      { cwd: input.workDirectory, env },
    );
    const send = (message: Record<string, unknown>) =>
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    let streamed = "";
    let model: string | null = input.model;
    let errorMessage = "";
    let timedOut = false;
    let settled = false;
    const finish = (result: ChatResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      stopProcess(child);
      resolve(result);
    };
    const fail = () =>
      finish({
        status: "failed",
        code: classifyRunFailure(
          { aborted: input.signal?.aborted ?? false, timedOut, stdout: "", stderr: "" },
          errorMessage,
        ),
      });
    const abort = () => fail();
    const timer = setTimeout(() => {
      timedOut = true;
      fail();
    }, chatTimeoutMs);
    input.signal?.addEventListener("abort", abort, { once: true });
    child.on("error", fail);
    child.on("close", fail);
    child.stderr.resume();

    createInterface({ input: child.stdout }).on("line", (line) => {
      // Lines already buffered when the turn was stopped must not reach the answer.
      if (settled) return;
      const message = parseCodexEvent(line);
      if (!message) return;
      if (isUnsafeChatEvent(message)) {
        // The answer must never come from an agent that reads or runs anything.
        return finish({ status: "failed", code: "runFailed" });
      }
      if (message.method && message.id !== undefined) {
        send({ id: message.id, error: { code: -32601, message: "Not supported" } });
        return;
      }
      if (message.id === 1) {
        send({ method: "initialized" });
        send({
          id: 2,
          method: "thread/start",
          params: {
            cwd: input.workDirectory,
            sandbox: "read-only",
            approvalPolicy: "never",
            ephemeral: true,
            model: input.model,
            developerInstructions: input.instructions,
          },
        });
      } else if (message.id === 2) {
        const thread = message.result as { thread?: { id?: string }; model?: string } | undefined;
        if (!thread?.thread?.id) return fail();
        model = thread.model ?? model;
        send({
          id: 3,
          method: "turn/start",
          params: { threadId: thread.thread.id, input: [{ type: "text", text: input.prompt }] },
        });
      } else if (message.error && typeof message.id === "number") {
        errorMessage = String(message.error.message ?? "");
        fail();
      } else if (message.method === "item/agentMessage/delta") {
        const delta = message.params?.delta;
        if (typeof delta === "string") {
          streamed += delta;
          emit({ type: "delta", text: delta });
        }
      } else if (
        message.method === "item/reasoning/summaryTextDelta" ||
        message.method === "item/reasoning/textDelta"
      ) {
        const delta = message.params?.delta;
        if (typeof delta === "string") emit({ type: "reasoning", text: delta });
      } else if (message.method === "error") {
        errorMessage = String(message.params?.error?.message ?? errorMessage);
      } else if (message.method === "turn/completed") {
        const turn = message.params?.turn;
        if (turn?.status !== "completed") {
          errorMessage = String(turn?.error?.message ?? errorMessage);
          return fail();
        }
        finish({
          status: "completed",
          text: finalAgentMessage(turn.items) ?? streamed,
          model: model ? { id: model, name: model } : null,
        });
      }
    });

    send({
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "openmonetis", version: "1" } },
    });
  });
}

type CodexEvent = {
  id?: unknown;
  method?: string;
  result?: unknown;
  error?: { message?: unknown };
  params?: {
    delta?: unknown;
    item?: { type?: unknown };
    error?: { message?: unknown };
    turn?: { status?: unknown; error?: { message?: unknown }; items?: unknown };
  };
};

function parseCodexEvent(line: string): CodexEvent | null {
  return parseJsonLine(line) as CodexEvent | null;
}

/** An app-server item that would read files, run a command or call a tool. */
export function isUnsafeChatEvent(message: CodexEvent | null) {
  if (message?.method !== "item/started" && message?.method !== "item/completed") return false;
  return !safeChatItemTypes.has(String(message.params?.item?.type));
}

/** A `codex exec --json` item that would read files, run a command or call a tool. */
export function isUnsafeRunEvent(event: unknown) {
  const { type, item } = (event ?? {}) as { type?: unknown; item?: { type?: unknown } };
  if (type !== "item.started" && type !== "item.updated" && type !== "item.completed") return false;
  return !safeRunItemTypes.has(String(item?.type));
}

/** The final answer of a completed turn, when the server includes the turn items. */
export function finalAgentMessage(items: unknown) {
  if (!Array.isArray(items)) return null;
  const messages = items.filter(
    (item): item is { type: string; text: string } =>
      item?.type === "agentMessage" && typeof item.text === "string",
  );
  return messages.at(-1)?.text ?? null;
}

export function parseCodexLoginPrompt(output: string): LoginPrompt | null {
  const text = output.replace(terminalColorPattern, "");
  const verificationUrl = text.match(verificationUrlPattern)?.[0] ?? null;
  const userCode = text.match(userCodePattern)?.[0] ?? null;
  return verificationUrl && userCode ? { verificationUrl, userCode } : null;
}

/**
 * The models this ChatGPT account may use, from the Codex app server (`model/list`). Only the
 * catalog is read: no thread or turn is started. Failures yield an empty catalog.
 */
async function readCodexModels(command: string, home: string, env: Record<string, string>) {
  const result = await requestCodexAppServer(command, home, env, {
    method: "model/list",
    params: {},
  });
  return parseCodexModels(result);
}

/**
 * Sends one read-only request to a short-lived Codex app server and returns its `result`, or
 * `undefined` when the server fails, times out or answers with an error.
 */
function requestCodexAppServer(
  command: string,
  home: string,
  env: Record<string, string>,
  request: { method: string; params: Record<string, unknown> },
): Promise<unknown> {
  return new Promise((resolve) => {
    const child = startInteractiveCommand(command, [...subscriptionConfig, "app-server"], {
      cwd: home,
      env,
    });
    let settled = false;
    const finish = (result: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stopProcess(child);
      resolve(result);
    };
    const timer = setTimeout(() => finish(undefined), appServerTimeoutMs);
    child.on("error", () => finish(undefined));
    child.on("close", () => finish(undefined));
    child.stderr.resume();
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = parseJsonLine(line);
      if (message?.id === 1) {
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "initialized" })}\n`);
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, ...request })}\n`);
      }
      if (message?.id === 2) finish(message.result);
    });
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "openmonetis", version: "1" } },
      })}\n`,
    );
  });
}

/** `account/read` answers `{ account: { type: "chatgpt", email, planType } }` for a plan sign-in. */
export function parseCodexAccountEmail(result: unknown): string | null {
  const account = (result as { account?: unknown } | null | undefined)?.account as
    | { type?: unknown; email?: unknown }
    | null
    | undefined;
  return account && account.type !== "apiKey" ? accountEmailOf(account.email) : null;
}

export function parseCodexModels(result: unknown): ProviderModel[] {
  const data = (result as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const model = item as {
      id?: unknown;
      displayName?: unknown;
      hidden?: unknown;
      isDefault?: unknown;
    };
    if (typeof model.id !== "string" || model.hidden === true) return [];
    return [
      {
        id: model.id,
        name: typeof model.displayName === "string" ? model.displayName : model.id,
        isDefault: model.isDefault === true,
      },
    ];
  });
}

function parseJsonLine(line: string): { id?: unknown; result?: unknown } | null {
  try {
    const value = JSON.parse(line) as unknown;
    return value && typeof value === "object"
      ? (value as { id?: unknown; result?: unknown })
      : null;
  } catch {
    return null;
  }
}

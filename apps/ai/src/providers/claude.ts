import { aiProviderLoginMethodByProvider } from "@openmonetis/domain/ai-providers";
import { createCliEnvironment } from "../utils/env";
import { runCommand } from "../utils/process";
import {
  accountEmailOf,
  type CommandSource,
  classifyRunFailure,
  commandOf,
  type LoginPrompt,
  type ProviderAccount,
  type ProviderAdapter,
} from "./provider";

const statusTimeoutMs = 15_000;
const runTimeoutMs = 180_000;
const authorizationUrlPattern = /https:\/\/\S+\/oauth\/authorize\?\S+/;

/** Telemetry, error reports, feedback surveys and other non-essential traffic stay off. */
export const claudePrivacyEnvironment = {
  DISABLE_TELEMETRY: "1",
  DISABLE_ERROR_REPORTING: "1",
  DISABLE_BUG_COMMAND: "1",
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
};

/** Claude Code resolves these aliases to the newest model of each family available to the plan. */
const claudeModelAliases = [
  { id: "sonnet", name: "Sonnet", isDefault: false },
  { id: "opus", name: "Opus", isDefault: false },
  { id: "haiku", name: "Haiku", isDefault: false },
];

type ClaudeResult = {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  modelUsage?: Record<string, unknown>;
};

/**
 * Claude Code, run as published with the person's own subscription. `CLAUDE_CONFIG_DIR` points
 * at that user's home, where Claude Code keeps the credentials from its own sign-in flow; this
 * service never reads them.
 */
export function createClaudeProvider(cli: CommandSource = "claude"): ProviderAdapter {
  const environment = (home: string) =>
    createCliEnvironment({ CLAUDE_CONFIG_DIR: home, ...claudePrivacyEnvironment });

  return {
    provider: "claude",
    loginMethod: aiProviderLoginMethodByProvider.claude,

    async readAccount(home) {
      const result = await runCommand(commandOf(cli), ["auth", "status", "--json"], {
        env: environment(home),
        timeoutMs: statusTimeoutMs,
      });
      return parseClaudeAccount(result.stdout);
    },

    loginCommand(home) {
      return {
        command: commandOf(cli),
        args: ["auth", "login", "--claudeai"],
        env: environment(home),
      };
    },

    parseLoginPrompt: parseClaudeLoginPrompt,

    async logout(home) {
      await runCommand(commandOf(cli), ["auth", "logout"], {
        env: environment(home),
        timeoutMs: statusTimeoutMs,
      });
    },

    async listModels() {
      return claudeModelAliases;
    },

    async run(home, input) {
      const result = await runCommand(
        commandOf(cli),
        [
          ...(input.model ? ["--model", input.model] : []),
          "--print",
          "--output-format",
          "json",
          "--json-schema",
          JSON.stringify(input.schema),
          "--tools",
          "",
          "--strict-mcp-config",
          "--setting-sources",
          "",
          "--no-session-persistence",
          "--append-system-prompt",
          input.instructions,
        ],
        {
          cwd: input.workDirectory,
          env: environment(home),
          input: input.prompt,
          timeoutMs: runTimeoutMs,
          signal: input.signal,
        },
      );
      const payload = parseClaudeResult(result.stdout);
      if (result.exitCode !== 0 || !payload || payload.is_error) {
        return { status: "failed", code: classifyRunFailure(result, payload?.result) };
      }
      if (payload.structured_output === undefined)
        return { status: "failed", code: "invalidOutput" };
      return { status: "completed", output: payload.structured_output, model: usedModel(payload) };
    },

    async chat(home, input, emit) {
      let streamed = "";
      let payload: ClaudeResult | null = null;
      const result = await runCommand(
        commandOf(cli),
        [
          ...(input.model ? ["--model", input.model] : []),
          "--print",
          "--output-format",
          "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--tools",
          "",
          "--strict-mcp-config",
          "--setting-sources",
          "",
          "--no-session-persistence",
          "--append-system-prompt",
          input.instructions,
        ],
        {
          cwd: input.workDirectory,
          env: environment(home),
          input: input.prompt,
          timeoutMs: runTimeoutMs,
          signal: input.signal,
          onStdoutLine: (line) => {
            const parsed = parseClaudeStreamLine(line);
            if (parsed?.kind === "delta") {
              streamed += parsed.text;
              emit({ type: "delta", text: parsed.text });
            } else if (parsed?.kind === "reasoning") {
              emit({ type: "reasoning", text: parsed.text });
            } else if (parsed?.kind === "result") {
              payload = parsed.payload;
            }
          },
        },
      );
      const final = payload as ClaudeResult | null;
      if (result.aborted || result.exitCode !== 0 || !final || final.is_error) {
        return { status: "failed", code: classifyRunFailure(result, final?.result) };
      }
      return { status: "completed", text: final.result ?? streamed, model: usedModel(final) };
    },
  };
}

export type ClaudeStreamLine =
  | { kind: "delta"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "result"; payload: ClaudeResult };

/** One line of `--output-format stream-json --include-partial-messages`. */
export function parseClaudeStreamLine(line: string): ClaudeStreamLine | null {
  const message = parseClaudeResult(line) as
    | (ClaudeResult & {
        type?: unknown;
        event?: { type?: unknown; delta?: { type?: unknown; text?: unknown; thinking?: unknown } };
      })
    | null;
  if (!message) return null;
  if (message.type === "result") return { kind: "result", payload: message };
  const delta = message.type === "stream_event" ? message.event?.delta : undefined;
  if (message.event?.type !== "content_block_delta" || !delta) return null;
  if (delta.type === "text_delta" && typeof delta.text === "string") {
    return { kind: "delta", text: delta.text };
  }
  if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
    return { kind: "reasoning", text: delta.thinking };
  }
  return null;
}

export function parseClaudeLoginPrompt(output: string): LoginPrompt | null {
  const verificationUrl = output.match(authorizationUrlPattern)?.[0] ?? null;
  return verificationUrl ? { verificationUrl, userCode: null } : null;
}

/** `claude-sonnet-5-5` → `Sonnet 5.5`; unknown shapes keep their id. */
export function formatClaudeModelName(id: string) {
  const match = id.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-|$)/);
  if (!match?.[1] || !match[2]) return id;
  const family = `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}`;
  return `${family} ${match[2]}${match[3] ? `.${match[3]}` : ""}`;
}

/** `claude auth status --json`: only a subscription sign-in counts as connected. */
export function parseClaudeAccount(output: string): ProviderAccount | null {
  try {
    const status = JSON.parse(output) as {
      loggedIn?: unknown;
      authMethod?: unknown;
      email?: unknown;
    };
    const isSubscription =
      status.loggedIn === true &&
      typeof status.authMethod === "string" &&
      !/api.?key|none/i.test(status.authMethod);
    return isSubscription ? { email: accountEmailOf(status.email) } : null;
  } catch {
    return null;
  }
}

function usedModel(payload: ClaudeResult) {
  const id = Object.keys(payload.modelUsage ?? {})[0];
  return id ? { id, name: formatClaudeModelName(id) } : null;
}

function parseClaudeResult(output: string): ClaudeResult | null {
  try {
    const payload = JSON.parse(output) as unknown;
    return payload && typeof payload === "object" ? (payload as ClaudeResult) : null;
  } catch {
    return null;
  }
}

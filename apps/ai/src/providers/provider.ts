import type { AiProvider, AiProviderLoginMethod } from "@openmonetis/domain/ai-providers";
import type { ProcessResult } from "../utils/process";

export type RunFailureCode =
  | "providerDisconnected"
  | "providerLimitReached"
  | "invalidOutput"
  | "runFailed"
  | "timedOut"
  | "canceled";

export type ProviderModel = { id: string; name: string; isDefault: boolean };

export type RunInput = {
  instructions: string;
  prompt: string;
  schema: Record<string, unknown>;
  /** `null` uses the CLI's own default for the account. */
  model: string | null;
  workDirectory: string;
  /** Aborted when the person stops the diagnosis; the CLI process is terminated. */
  signal?: AbortSignal;
};

export type RunResult =
  | { status: "completed"; output: unknown; model: Omit<ProviderModel, "isDefault"> | null }
  | { status: "failed"; code: RunFailureCode };

export type ChatInput = {
  instructions: string;
  prompt: string;
  model: string | null;
  workDirectory: string;
  signal?: AbortSignal;
};

/** What a chat streams while the CLI answers. */
export type ChatEvent = { type: "delta"; text: string } | { type: "reasoning"; text: string };

export type ChatResult =
  | { status: "completed"; text: string; model: Omit<ProviderModel, "isDefault"> | null }
  | { status: "failed"; code: Exclude<RunFailureCode, "invalidOutput"> };

/** A fixed command, or one read before each call so a newly activated CLI build is used. */
export type CommandSource = string | (() => string);

export function commandOf(source: CommandSource) {
  return typeof source === "function" ? source() : source;
}

/** A live subscription sign-in; `email` is `null` when the CLI does not report it. */
export type ProviderAccount = { email: string | null };

/** Keeps an account email only when it looks like one, so CLI noise never reaches the UI. */
export function accountEmailOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type LoginCommand = { command: string; args: string[]; env: Record<string, string> };

export type LoginPrompt = { verificationUrl: string | null; userCode: string | null };

/** One vendor CLI. Each call receives the user's own sign-in home; nothing is shared. */
export type ProviderAdapter = {
  provider: AiProvider;
  loginMethod: AiProviderLoginMethod;
  /** How long a sign-in may stay pending, when the CLI itself gives up sooner than usual. */
  loginLifetimeMs?: number;
  /** The signed-in subscription account, or `null` when disconnected. */
  readAccount(home: string): Promise<ProviderAccount | null>;
  loginCommand(home: string): LoginCommand;
  parseLoginPrompt(output: string): LoginPrompt | null;
  logout(home: string): Promise<void>;
  listModels(home: string): Promise<ProviderModel[]>;
  run(home: string, input: RunInput): Promise<RunResult>;
  chat(home: string, input: ChatInput, emit: (event: ChatEvent) => void): Promise<ChatResult>;
};

const limitPattern =
  /usage limit|rate.?limit|limit reached|too many requests|quota|resource.?exhausted/i;
const authPattern =
  /not logged in|log ?in again|\/login|unauthori[sz]ed|authenticat|401|expired token/i;

/** Maps a failed CLI run to a failure the API can explain without exposing CLI output. */
export function classifyRunFailure(
  result: Pick<ProcessResult, "aborted" | "timedOut" | "stdout" | "stderr">,
  message = "",
): Exclude<RunFailureCode, "invalidOutput"> {
  if (result.aborted) return "canceled";
  if (result.timedOut) return "timedOut";
  const text = `${message}\n${result.stdout}\n${result.stderr}`;
  if (limitPattern.test(text)) return "providerLimitReached";
  if (authPattern.test(text)) return "providerDisconnected";
  return "runFailed";
}

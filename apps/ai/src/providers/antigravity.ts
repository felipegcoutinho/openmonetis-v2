import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { aiProviderLoginMethodByProvider } from "@openmonetis/domain/ai-providers";
import { createCliEnvironment } from "../utils/env";
import { runCommand } from "../utils/process";
import {
  type ChatEvent,
  type ChatResult,
  type CommandSource,
  classifyRunFailure,
  commandOf,
  type LoginCommand,
  type LoginPrompt,
  type ProviderAdapter,
  type ProviderModel,
  type RunResult,
} from "./provider";

const statusTimeoutMs = 15_000;
/**
 * Gemini's "High" models reason for minutes (about 20k thinking tokens for one diagnosis), so runs
 * get longer than the other CLIs, still inside the API's own deadline.
 */
const runTimeoutMs = 270_000;
/** The CLI waits 60 seconds for the pasted code; the sign-in here ends a little earlier. */
const loginLifetimeMs = 55_000;
const authorizationUrlPattern = /https:\/\/accounts\.google\.com\/o\/oauth2\/\S+/;
const modelLinePattern = /^\s*([A-Za-z0-9][A-Za-z0-9._:-]{0,79})(?:\t+|\s{2,})(\S.*?)\s*$/;
const conversationIdPattern = /^[A-Za-z0-9-]{8,80}$/;
const terminalControlPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");

/** The CLI signs in only while a prompt runs, so the sign-in asks for the smallest answer. */
const connectionPrompt = "Responda apenas: ok";
const agentName = "openmonetis";
const runPrompt = "Siga as instruções e produza a resposta pedida.";
const jsonAnswerInstruction =
  "Responda somente com um objeto JSON válido, sem texto nem blocos de código ao redor, que siga este JSON Schema:";
const chatPrompt = "Responda à última mensagem da conversa, seguindo as instruções.";
/**
 * Tools the run's agent may still call. The `init` event lists the CLI's whole catalog whatever the
 * agent allows, so safety is checked on the tool calls the run actually makes.
 */
const allowedTools = new Set(["manage_task", "finish"]);

type AntigravityResult = {
  status?: unknown;
  response?: unknown;
  error?: unknown;
  structured_output?: unknown;
};

export type AntigravityStreamLine = { conversationId: string | null } & (
  | { kind: "init"; model: string | null }
  | { kind: "delta"; text: string }
  | { kind: "tool"; name: string }
  | { kind: "step" }
  | { kind: "result"; payload: AntigravityResult }
);

/**
 * Antigravity CLI (`agy`), run as published with the person's own Google sign-in. `HOME` points at
 * that user's home, where the CLI keeps the credentials from its own sign-in flow; this service
 * never reads them. Every answer comes from an agent with no tools, written next to the run.
 */
export function createAntigravityProvider(
  cli: CommandSource = "agy",
  platform: NodeJS.Platform = process.platform,
): ProviderAdapter {
  const environment = (home: string) => createCliEnvironment({ HOME: home });

  async function prompt(
    home: string,
    input: {
      instructions: string;
      prompt: string;
      model: string | null;
      workDirectory: string;
      signal?: AbortSignal;
    },
    question: string,
    extraArgs: string[],
    onDelta?: (text: string) => void,
  ) {
    const workspace = await writeAgent(input.workDirectory, input.instructions, input.prompt);
    const guard = new AbortController();
    let unsafeTools = false;
    let conversationId: string | null = null;
    let payload: AntigravityResult | null = null;
    const result = await runCommand(
      commandOf(cli),
      [
        "--print",
        question,
        "--output-format",
        "stream-json",
        "--agent",
        agentName,
        "--disable-slash-commands",
        ...(input.model ? ["--model", input.model] : []),
        ...extraArgs,
      ],
      {
        cwd: workspace,
        env: environment(home),
        timeoutMs: runTimeoutMs,
        signal: input.signal ? AbortSignal.any([input.signal, guard.signal]) : guard.signal,
        onStdoutLine: (line) => {
          const parsed = parseAntigravityStreamLine(line);
          conversationId ??= parsed?.conversationId ?? null;
          if (parsed?.kind === "tool" && !allowedTools.has(parsed.name)) {
            // The answer must never come from an agent that reads or runs anything.
            unsafeTools = true;
            guard.abort();
          } else if (parsed?.kind === "delta") {
            onDelta?.(parsed.text);
          } else if (parsed?.kind === "result") {
            payload = parsed.payload;
          }
        },
      },
    );
    // The CLI keeps every conversation in the home; the financial data in it is removed right away.
    if (conversationId) await forgetConversation(home, conversationId);
    const final = payload as AntigravityResult | null;
    const failure =
      unsafeTools || (!input.signal?.aborted && guard.signal.aborted)
        ? ("runFailed" as const)
        : result.exitCode !== 0 || final?.status !== "SUCCESS"
          ? classifyRunFailure(
              { ...result, aborted: input.signal?.aborted ?? false },
              typeof final?.error === "string" ? final.error : "",
            )
          : null;
    return { failure, payload: final };
  }

  async function usedModel(home: string, model: string | null) {
    if (!model) return null;
    const models = await readAntigravityModels(commandOf(cli), environment(home));
    return { id: model, name: models.find((item) => item.id === model)?.name ?? model };
  }

  return {
    provider: "antigravity",
    loginMethod: aiProviderLoginMethodByProvider.antigravity,
    loginLifetimeMs,

    // The CLI has no status command and reports no account email; a usable catalog means signed in.
    async readAccount(home) {
      const models = await readAntigravityModels(commandOf(cli), environment(home));
      return models.length > 0 ? { email: null } : null;
    },

    loginCommand(home) {
      return {
        ...inTerminal(platform, commandOf(cli), [
          "--print",
          connectionPrompt,
          "--output-format",
          "json",
        ]),
        env: environment(home),
      };
    },

    parseLoginPrompt: parseAntigravityLoginPrompt,

    // The CLI has no sign-out command; its credentials live only in the home the caller removes.
    async logout() {},

    listModels(home) {
      return readAntigravityModels(commandOf(cli), environment(home));
    },

    async run(home, input): Promise<RunResult> {
      // `--json-schema` is ignored once the agent drops the default components, so the schema
      // travels in the instructions and the API validates the answer like any other provider's.
      const instructions = `${input.instructions}\n\n${jsonAnswerInstruction}\n${JSON.stringify(input.schema)}`;
      const { failure, payload } = await prompt(home, { ...input, instructions }, runPrompt, []);
      if (failure) return { status: "failed", code: failure };
      const output = structuredOutput(payload);
      if (output === undefined) return { status: "failed", code: "invalidOutput" };
      return { status: "completed", output, model: await usedModel(home, input.model) };
    },

    async chat(home, input, emit: (event: ChatEvent) => void): Promise<ChatResult> {
      let streamed = "";
      const { failure, payload } = await prompt(home, input, chatPrompt, [], (text) => {
        streamed += text;
        emit({ type: "delta", text });
      });
      if (failure) return { status: "failed", code: failure };
      const text = typeof payload?.response === "string" ? payload.response : streamed;
      return { status: "completed", text, model: await usedModel(home, input.model) };
    },
  };
}

/**
 * The CLI asks for its sign-in only inside a terminal, so the sign-in runs under `script`, which
 * gives it one; the code the person pastes is written to that terminal. The macOS `script` refuses
 * the socket Node uses as stdin, so there it reads from a pipe fed by `cat`.
 */
export function inTerminal(
  platform: NodeJS.Platform,
  command: string,
  args: string[],
): Omit<LoginCommand, "env"> {
  if (platform === "darwin") {
    return {
      command: "bash",
      args: ["-c", 'script -q /dev/null "$@" < <(cat)', "bash", command, ...args],
    };
  }
  return {
    command: "script",
    args: ["-q", "-e", "-c", [command, ...args].map(quoteForShell).join(" "), "/dev/null"],
  };
}

export function parseAntigravityLoginPrompt(output: string): LoginPrompt | null {
  const verificationUrl = output.match(authorizationUrlPattern)?.[0] ?? null;
  return verificationUrl ? { verificationUrl, userCode: null } : null;
}

/** `agy models` prints one `slug<TAB>Display name` line per model the account can use. */
export function parseAntigravityModels(output: string): ProviderModel[] {
  const models: ProviderModel[] = [];
  for (const line of output.replace(terminalControlPattern, "").split(/\r?\n/)) {
    const match = line.match(modelLinePattern);
    if (!match?.[1] || !match[2]) continue;
    const isDefault = /\(default\)/i.test(match[2]);
    const name = match[2].replace(/\s*\(default\)/i, "").trim();
    models.push({ id: match[1], name: name || match[1], isDefault });
  }
  return models;
}

/**
 * One line of `--output-format stream-json`: `init`, `step_update` (nested under `step_update`,
 * with `step_type` such as `user_input`, `agent_response` or `tool`) or the final `result`.
 */
export function parseAntigravityStreamLine(line: string): AntigravityStreamLine | null {
  type Fields = {
    conversation_id?: unknown;
    model?: unknown;
    step_type?: unknown;
    text_delta?: unknown;
    tool_name?: unknown;
  };
  let message: Fields & {
    event?: unknown;
    init?: Fields;
    step_update?: Fields;
    result?: AntigravityResult & Fields;
  };
  try {
    message = JSON.parse(line);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object") return null;
  const fields: Fields =
    (message.event === "init" && message.init) ||
    (message.event === "step_update" && message.step_update) ||
    (message.event === "result" && message.result) ||
    message;
  const conversationIdOf = (value: unknown) =>
    typeof value === "string" && conversationIdPattern.test(value) ? value : null;
  const conversationId =
    conversationIdOf(message.conversation_id) ?? conversationIdOf(fields.conversation_id);

  if (message.event === "init") {
    return {
      kind: "init",
      conversationId,
      model: typeof fields.model === "string" ? fields.model : null,
    };
  }
  if (message.event === "step_update") {
    if (typeof fields.tool_name === "string" && fields.tool_name) {
      return { kind: "tool", conversationId, name: fields.tool_name };
    }
    const isAnswer = fields.step_type === undefined || fields.step_type === "agent_response";
    return isAnswer && typeof fields.text_delta === "string" && fields.text_delta
      ? { kind: "delta", conversationId, text: fields.text_delta }
      : { kind: "step", conversationId };
  }
  if (message.event === "result" && message.result && typeof message.result === "object") {
    return { kind: "result", conversationId, payload: message.result };
  }
  return null;
}

/** Removes everything the CLI stored about one conversation, which is named after its id. */
async function forgetConversation(home: string, conversationId: string) {
  const root = path.join(home, ".gemini", "antigravity-cli");
  const folders = await readdir(root, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    folders
      .filter((folder) => folder.isDirectory())
      .map(async (folder) => {
        const directory = path.join(root, folder.name);
        const entries = await readdir(directory).catch(() => []);
        await Promise.all(
          entries
            .filter((entry) => entry === conversationId || entry.startsWith(`${conversationId}.`))
            .map((entry) => rm(path.join(directory, entry), { recursive: true, force: true })),
        );
      }),
  );
}

async function readAntigravityModels(command: string, env: Record<string, string>) {
  const result = await runCommand(command, ["models"], { env, timeoutMs: statusTimeoutMs });
  return result.exitCode === 0 ? parseAntigravityModels(result.stdout) : [];
}

/**
 * The run's own agent: no tools, MCP servers or customizations, and the instructions plus the
 * prompt as its system prompt, so the financial data never travels as a command-line argument.
 */
async function writeAgent(workDirectory: string, instructions: string, prompt: string) {
  const workspace = path.join(workDirectory, "workspace");
  const agents = path.join(workspace, ".agents", "agents");
  await mkdir(agents, { recursive: true });
  const definition = [
    "---",
    `name: ${agentName}`,
    "description: Responde usando apenas os dados financeiros fornecidos.",
    "tools: []",
    "excludeDefaultComponents: true",
    "inheritMcp: false",
    "inheritCustomizations: false",
    "---",
    instructions,
    "",
    prompt,
    "",
  ].join("\n");
  await writeFile(path.join(agents, `${agentName}.md`), definition, { mode: 0o600 });
  return workspace;
}

/** The answer's JSON object, tolerating a code fence or a sentence the model adds around it. */
export function structuredOutput(payload: AntigravityResult | null) {
  if (payload?.structured_output !== undefined) return payload.structured_output;
  if (typeof payload?.response !== "string") return undefined;
  const start = payload.response.indexOf("{");
  const end = payload.response.lastIndexOf("}");
  if (start < 0 || end < start) return undefined;
  try {
    return JSON.parse(payload.response.slice(start, end + 1)) as unknown;
  } catch {
    return undefined;
  }
}

function quoteForShell(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

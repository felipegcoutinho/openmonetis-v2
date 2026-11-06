import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAiServiceApp } from "./app";
import type { LoginSessions } from "./login-sessions";
import {
  createAntigravityProvider,
  inTerminal,
  parseAntigravityLoginPrompt,
  parseAntigravityModels,
  parseAntigravityStreamLine,
  structuredOutput,
} from "./providers/antigravity";
import {
  claudePrivacyEnvironment,
  formatClaudeModelName,
  parseClaudeAccount,
  parseClaudeLoginPrompt,
  parseClaudeStreamLine,
} from "./providers/claude";
import {
  createCodexProvider,
  finalAgentMessage,
  isUnsafeChatEvent,
  isUnsafeRunEvent,
  parseCodexAccountEmail,
  parseCodexLoginPrompt,
  parseCodexModels,
  subscriptionConfig,
  toolsOffConfig,
} from "./providers/codex";
import { classifyRunFailure, type ProviderAdapter, type RunInput } from "./providers/provider";
import type { ToolManager } from "./tools/manager";
import { runCommand } from "./utils/process";

const secret = "test-secret";
const homeId = "a".repeat(64);
const authorization = { authorization: `Bearer ${secret}` };

function fakeProvider(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    provider: "claude",
    loginMethod: "authorizationCode",
    readAccount: async () => ({ email: "pessoa@example.com" }),
    loginCommand: () => ({ command: "true", args: [], env: {} }),
    parseLoginPrompt: () => null,
    logout: async () => undefined,
    listModels: async () => [{ id: "sonnet", name: "Sonnet", isDefault: false }],
    run: async () => ({ status: "completed", output: { ok: true }, model: null }),
    chat: async (_home, _input, emit) => {
      emit({ type: "reasoning", text: "pensando" });
      emit({ type: "delta", text: "Olá" });
      emit({ type: "delta", text: " mundo" });
      return { status: "completed", text: "Olá mundo", model: { id: "sonnet", name: "Sonnet" } };
    },
    ...overrides,
  };
}

async function withApp(
  provider: ProviderAdapter,
  callback: (app: ReturnType<typeof createAiServiceApp>, homes: string) => Promise<void>,
) {
  const homes = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-test-"));
  try {
    await callback(
      createAiServiceApp({
        secret,
        homesDirectory: homes,
        providers: [provider],
        loginSessions: { cancelAll: () => undefined } as unknown as LoginSessions,
      }),
      homes,
    );
  } finally {
    await rm(homes, { recursive: true, force: true });
  }
}

const runBody = JSON.stringify({ instructions: "i", prompt: "p", schema: { type: "object" } });

test("every home route requires the shared secret", async () => {
  await withApp(fakeProvider(), async (app) => {
    const missing = await app.request(`/homes/${homeId}/providers/claude`);
    const wrong = await app.request(`/homes/${homeId}/providers/claude`, {
      headers: { authorization: "Bearer other" },
    });
    const health = await app.request("/health");

    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(health.status, 200);
  });
});

test("tool routes require the shared secret, and a run holds the build it uses", async () => {
  const holds: string[] = [];
  const tools = {
    list: async () => [],
    hold: (provider: string) => {
      holds.push(`hold:${provider}`);
      return () => holds.push(`release:${provider}`);
    },
  } as unknown as ToolManager;
  const homes = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-test-"));
  try {
    const app = createAiServiceApp({
      secret,
      homesDirectory: homes,
      providers: [fakeProvider()],
      loginSessions: { cancelAll: () => undefined } as unknown as LoginSessions,
      tools,
    });
    assert.equal((await app.request("/tools")).status, 401);
    assert.equal((await app.request("/tools/claude/installs", { method: "POST" })).status, 401);
    assert.equal((await app.request("/tools", { headers: authorization })).status, 200);

    await app.request(`/homes/${homeId}/providers/claude/runs`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: runBody,
    });
    assert.deepEqual(holds.slice(-2), ["hold:claude", "release:claude"]);
  } finally {
    await rm(homes, { recursive: true, force: true });
  }
});

test("home ids and providers outside the allow-list are rejected", async () => {
  await withApp(fakeProvider(), async (app) => {
    const traversal = await app.request("/homes/..%2F..%2Fetc/providers/claude", {
      headers: authorization,
    });
    const unknown = await app.request(`/homes/${homeId}/providers/gemini`, {
      headers: authorization,
    });

    assert.equal(traversal.status, 404);
    assert.equal(unknown.status, 404);
  });
});

test("a run receives the user's own home and an isolated work directory", async () => {
  let received: { home: string; input: RunInput } | undefined;
  const provider = fakeProvider({
    run: async (home, input) => {
      received = { home, input };
      return { status: "completed", output: { ok: true }, model: null };
    },
  });

  await withApp(provider, async (app, homes) => {
    const response = await app.request(`/homes/${homeId}/providers/claude/runs`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: runBody,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { status: "completed", output: { ok: true }, model: null },
      error: null,
    });
    assert.equal(received?.input.model, null);
    assert.equal(received?.home, path.join(homes, homeId, "claude"));
    await assert.rejects(stat(received?.input.workDirectory ?? ""));
  });
});

test("a second run for the same home while one is running is refused", async () => {
  let release: () => void = () => undefined;
  const provider = fakeProvider({
    run: () =>
      new Promise((resolve) => {
        release = () => resolve({ status: "completed", output: {}, model: null });
      }),
  });

  await withApp(provider, async (app) => {
    const request = () =>
      app.request(`/homes/${homeId}/providers/claude/runs`, {
        method: "POST",
        headers: { ...authorization, "content-type": "application/json" },
        body: runBody,
      });
    const first = request();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await request();
    release();

    assert.deepEqual((await second.json()).data, { status: "failed", code: "providerBusy" });
    assert.equal((await first).status, 200);
  });
});

test("the status reports the signed-in account email", async () => {
  await withApp(fakeProvider(), async (app) => {
    const response = await app.request(`/homes/${homeId}/providers/claude`, {
      headers: authorization,
    });
    assert.deepEqual((await response.json()).data, {
      connected: true,
      email: "pessoa@example.com",
    });
  });
  await withApp(fakeProvider({ readAccount: async () => null }), async (app) => {
    const response = await app.request(`/homes/${homeId}/providers/claude`, {
      headers: authorization,
    });
    assert.deepEqual((await response.json()).data, { connected: false, email: null });
  });
});

test("disconnecting removes the provider home", async () => {
  await withApp(fakeProvider(), async (app, homes) => {
    const response = await app.request(`/homes/${homeId}/providers/claude`, {
      method: "DELETE",
      headers: authorization,
    });

    assert.equal(response.status, 200);
    await assert.rejects(stat(path.join(homes, homeId, "claude")));
  });
});

test("login prompts are read from each CLI's own output", () => {
  assert.deepEqual(
    parseClaudeLoginPrompt(
      "Opening browser\nIf the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&state=x\nPaste code here if prompted >",
    ),
    { verificationUrl: "https://claude.com/cai/oauth/authorize?code=true&state=x", userCode: null },
  );
  assert.deepEqual(
    parseCodexLoginPrompt(
      "1. Open this link\n   https://auth.openai.com/codex/device\n2. Enter this one-time code\n   VSBA-M5L5D\n",
    ),
    { verificationUrl: "https://auth.openai.com/codex/device", userCode: "VSBA-M5L5D" },
  );
  assert.equal(parseCodexLoginPrompt("Welcome to Codex"), null);
});

test("only a subscription sign-in counts as connected", () => {
  assert.deepEqual(
    parseClaudeAccount('{"loggedIn":true,"authMethod":"claude.ai","email":"pessoa@example.com"}'),
    { email: "pessoa@example.com" },
  );
  assert.deepEqual(parseClaudeAccount('{"loggedIn":true,"authMethod":"claude.ai"}'), {
    email: null,
  });
  assert.deepEqual(
    parseClaudeAccount('{"loggedIn":true,"authMethod":"claude.ai","email":"not an email"}'),
    { email: null },
  );
  assert.equal(parseClaudeAccount('{"loggedIn":true,"authMethod":"apiKey"}'), null);
  assert.equal(parseClaudeAccount('{"loggedIn":false,"authMethod":"none"}'), null);
  assert.equal(parseClaudeAccount("not json"), null);
});

test("the Codex account email comes only from a plan sign-in", () => {
  assert.equal(
    parseCodexAccountEmail({
      account: { type: "chatgpt", email: "pessoa@example.com", planType: "plus" },
    }),
    "pessoa@example.com",
  );
  assert.equal(parseCodexAccountEmail({ account: { type: "apiKey" } }), null);
  assert.equal(parseCodexAccountEmail({ account: null }), null);
  assert.equal(parseCodexAccountEmail(undefined), null);
});

test("failed runs are classified without exposing CLI output", () => {
  const result = { exitCode: 1, stdout: "", stderr: "", timedOut: false, aborted: false };
  assert.equal(classifyRunFailure({ ...result, aborted: true, timedOut: true }), "canceled");
  assert.equal(classifyRunFailure({ ...result, timedOut: true }), "timedOut");
  assert.equal(classifyRunFailure(result, "Claude AI usage limit reached"), "providerLimitReached");
  assert.equal(classifyRunFailure(result, "RESOURCE_EXHAUSTED"), "providerLimitReached");
  assert.equal(classifyRunFailure({ ...result, stderr: "Not logged in" }), "providerDisconnected");
  assert.equal(classifyRunFailure(result), "runFailed");
});

test("model ids that could be read as CLI flags are rejected", async () => {
  await withApp(fakeProvider(), async (app) => {
    const response = await app.request(`/homes/${homeId}/providers/claude/runs`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({ instructions: "i", prompt: "p", schema: {}, model: "--dangerous" }),
    });
    const models = await app.request(`/homes/${homeId}/providers/claude/models`, {
      headers: authorization,
    });

    assert.equal(response.status, 400);
    assert.deepEqual((await models.json()).data, {
      models: [{ id: "sonnet", name: "Sonnet", isDefault: false }],
    });
  });
});

test("the Codex catalog keeps visible models and the account default", () => {
  assert.deepEqual(
    parseCodexModels({
      data: [
        { id: "gpt-a", displayName: "GPT A", hidden: false, isDefault: true },
        { id: "internal", displayName: "Internal", hidden: true },
        { id: "gpt-b" },
      ],
    }),
    [
      { id: "gpt-a", name: "GPT A", isDefault: true },
      { id: "gpt-b", name: "gpt-b", isDefault: false },
    ],
  );
  assert.equal(formatClaudeModelName("claude-sonnet-5-5"), "Sonnet 5.5");
});

test("stopping the current run aborts the CLI of that home only", async () => {
  let signal: AbortSignal | undefined;
  let started!: () => void;
  const running = new Promise<void>((resolve) => {
    started = resolve;
  });
  const provider = fakeProvider({
    run: (_home, input) =>
      new Promise((resolve) => {
        signal = input.signal;
        started();
        input.signal?.addEventListener("abort", () =>
          resolve({ status: "failed", code: "canceled" }),
        );
      }),
  });
  await withApp(provider, async (app) => {
    const run = app.request(`/homes/${homeId}/providers/claude/runs`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: runBody,
    });
    await running;
    const other = await app.request(`/homes/${"b".repeat(64)}/providers/claude/runs/current`, {
      method: "DELETE",
      headers: authorization,
    });
    assert.deepEqual((await other.json()).data, { canceled: false });
    assert.equal(signal?.aborted, false);

    const stop = await app.request(`/homes/${homeId}/providers/claude/runs/current`, {
      method: "DELETE",
      headers: authorization,
    });
    assert.deepEqual((await stop.json()).data, { canceled: true });
    assert.deepEqual((await (await run).json()).data, { status: "failed", code: "canceled" });
  });
});

test("an aborted command is terminated and reported as aborted", async () => {
  const controller = new AbortController();
  const pending = runCommand("sleep", ["30"], {
    env: { PATH: process.env.PATH ?? "" },
    timeoutMs: 60_000,
    signal: controller.signal,
  });
  controller.abort();
  const result = await pending;
  assert.equal(result.aborted, true);
  assert.equal(result.timedOut, false);
});

test("a chat streams NDJSON events and ends with the completed answer", async () => {
  await withApp(fakeProvider(), async (app) => {
    const response = await app.request(`/homes/${homeId}/providers/claude/chats`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({ instructions: "i", prompt: "p", model: null }),
    });
    assert.match(response.headers.get("content-type") ?? "", /ndjson/);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(events, [
      { type: "reasoning", text: "pensando" },
      { type: "delta", text: "Olá" },
      { type: "delta", text: " mundo" },
      {
        type: "completed",
        status: "completed",
        text: "Olá mundo",
        model: { id: "sonnet", name: "Sonnet" },
      },
    ]);
  });
});

test("Claude stream lines become text, reasoning and the final result", () => {
  const delta = (type: string, field: string, value: string) =>
    JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type, [field]: value } },
    });
  assert.deepEqual(parseClaudeStreamLine(delta("text_delta", "text", "Oi")), {
    kind: "delta",
    text: "Oi",
  });
  assert.deepEqual(parseClaudeStreamLine(delta("thinking_delta", "thinking", "hmm")), {
    kind: "reasoning",
    text: "hmm",
  });
  assert.equal(parseClaudeStreamLine('{"type":"system","subtype":"init"}'), null);
  assert.equal(parseClaudeStreamLine("not json"), null);
  assert.deepEqual(parseClaudeStreamLine('{"type":"result","result":"Oi"}'), {
    kind: "result",
    payload: { type: "result", result: "Oi" },
  });
});

test("the last Codex agent message of a turn is its answer", () => {
  assert.equal(
    finalAgentMessage([
      { type: "userMessage", text: "pergunta" },
      { type: "agentMessage", text: "rascunho" },
      { type: "agentMessage", text: "final" },
    ]),
    "final",
  );
  assert.equal(finalAgentMessage(undefined), null);
});

test("Codex items that read, run or fetch anything are recognized as unsafe", () => {
  for (const type of ["userMessage", "agentMessage", "reasoning", "plan"]) {
    assert.equal(isUnsafeChatEvent({ method: "item/started", params: { item: { type } } }), false);
  }
  for (const type of ["commandExecution", "fileChange", "mcpToolCall", "webSearch", "imageView"]) {
    assert.equal(isUnsafeChatEvent({ method: "item/started", params: { item: { type } } }), true);
    assert.equal(isUnsafeChatEvent({ method: "item/completed", params: { item: { type } } }), true);
  }
  assert.equal(isUnsafeChatEvent({ method: "item/started", params: {} }), true);
  assert.equal(isUnsafeChatEvent({ method: "item/agentMessage/delta", params: {} }), false);
  assert.equal(isUnsafeRunEvent({ type: "item.started", item: { type: "agent_message" } }), false);
  assert.equal(
    isUnsafeRunEvent({ type: "item.started", item: { type: "command_execution" } }),
    true,
  );
  assert.equal(isUnsafeRunEvent({ type: "item.completed", item: { type: "mcp_tool_call" } }), true);
  assert.equal(isUnsafeRunEvent({ type: "turn.completed" }), false);
});

/**
 * A stand-in Codex CLI: `exec` records its arguments, prints the scripted JSONL and writes the
 * last message; `app-server` answers the handshake, the model catalog and one scripted turn.
 */
async function withFakeCodex(
  stream: string[],
  use: (adapter: ProviderAdapter, workDirectory: string, argsFile: string) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openmonetis-codex-"));
  const command = path.join(directory, "codex");
  const argsFile = path.join(directory, "args.json");
  const workDirectory = path.join(directory, "run");
  await writeFile(
    command,
    [
      "#!/usr/bin/env node",
      'const fs = require("node:fs");',
      "const args = process.argv.slice(2);",
      `const stream = ${JSON.stringify(stream)};`,
      'if (args.includes("app-server")) {',
      `  fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));`,
      "  const reply = (message) => console.log(JSON.stringify({ jsonrpc: '2.0', ...message }));",
      '  require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {',
      "    const message = JSON.parse(line);",
      "    if (message.method === 'initialize') reply({ id: message.id, result: {} });",
      "    if (message.method === 'model/list') reply({ id: message.id, result: { data: [] } });",
      "    if (message.method === 'thread/start') reply({ id: message.id, result: { thread: { id: 't1' } } });",
      "    if (message.method === 'turn/start') for (const event of stream) console.log(event);",
      "  });",
      "} else {",
      `  fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));`,
      "  for (const event of stream) console.log(event);",
      '  fs.writeFileSync(args[args.indexOf("--output-last-message") + 1], \'{"score":80}\');',
      "}",
    ].join("\n"),
  );
  await chmod(command, 0o755);
  await mkdir(workDirectory);
  try {
    await use(createCodexProvider(command), workDirectory, argsFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const codexRunInput = (workDirectory: string): RunInput => ({
  instructions: "Seja breve.",
  prompt: "Dados: saldo 100",
  schema: { type: "object" },
  model: null,
  workDirectory,
});

test("a Codex run answers without tools and from the JSON event stream", async () => {
  await withFakeCodex(
    [
      '{"type":"thread.started","thread_id":"t1"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"{\\"score\\":80}"}}',
      '{"type":"turn.completed"}',
    ],
    async (adapter, workDirectory, argsFile) => {
      const result = await adapter.run(workDirectory, codexRunInput(workDirectory));
      assert.deepEqual(result, { status: "completed", output: { score: 80 }, model: null });
      const args = JSON.parse(await readFile(argsFile, "utf8")) as string[];
      for (const flag of toolsOffConfig) assert.ok(args.includes(flag), flag);
      assert.ok(args.includes("--json"));
    },
  );
});

test("a Codex run that starts a command is stopped before it answers", async () => {
  await withFakeCodex(
    [
      '{"type":"item.started","item":{"type":"command_execution","command":"cat auth.json"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}',
    ],
    async (adapter, workDirectory) => {
      const result = await adapter.run(workDirectory, codexRunInput(workDirectory));
      assert.deepEqual(result, { status: "failed", code: "runFailed" });
    },
  );
});

test("a Codex chat streams its answer from a thread without tools", async () => {
  await withFakeCodex(
    [
      '{"method":"item/started","params":{"item":{"type":"agentMessage"}}}',
      '{"method":"item/agentMessage/delta","params":{"delta":"Seu saldo "}}',
      '{"method":"item/agentMessage/delta","params":{"delta":"subiu."}}',
      '{"method":"turn/completed","params":{"turn":{"status":"completed","items":[]}}}',
    ],
    async (adapter, workDirectory, argsFile) => {
      const deltas: string[] = [];
      const result = await adapter.chat(
        workDirectory,
        { instructions: "", prompt: "Oi", model: null, workDirectory },
        (event) => {
          if (event.type === "delta") deltas.push(event.text);
        },
      );
      assert.deepEqual(deltas, ["Seu saldo ", "subiu."]);
      assert.deepEqual(result, { status: "completed", text: "Seu saldo subiu.", model: null });
      const args = JSON.parse(await readFile(argsFile, "utf8")) as string[];
      for (const flag of toolsOffConfig) assert.ok(args.includes(flag), flag);
    },
  );
});

test("a Codex chat that starts a command is stopped before it answers", async () => {
  await withFakeCodex(
    [
      '{"method":"item/started","params":{"item":{"type":"commandExecution","command":"cat auth.json"}}}',
      '{"method":"item/agentMessage/delta","params":{"delta":"segredo"}}',
      '{"method":"turn/completed","params":{"turn":{"status":"completed","items":[]}}}',
    ],
    async (adapter, workDirectory) => {
      const deltas: string[] = [];
      const result = await adapter.chat(
        workDirectory,
        { instructions: "", prompt: "Oi", model: null, workDirectory },
        (event) => {
          if (event.type === "delta") deltas.push(event.text);
        },
      );
      assert.deepEqual(deltas, []);
      assert.deepEqual(result, { status: "failed", code: "runFailed" });
    },
  );
});

test("Antigravity sign-in, models and stream lines are read from the CLI's output", () => {
  assert.deepEqual(
    parseAntigravityLoginPrompt(
      "Authentication required. Please visit the URL to log in:\r\n  https://accounts.google.com/o/oauth2/auth?client_id=x&state=y\r\n\r\nOr, paste the authorization code here and press Enter:",
    ),
    {
      verificationUrl: "https://accounts.google.com/o/oauth2/auth?client_id=x&state=y",
      userCode: null,
    },
  );
  assert.equal(parseAntigravityLoginPrompt("Fetching available models..."), null);
  assert.deepEqual(
    parseAntigravityModels(
      "Fetching available models...\ngemini-4-argon-high\tGemini 4 Argon (High)\nclaude-sonnet-5-5   Claude Sonnet 5.5 (default)\n",
    ),
    [
      { id: "gemini-4-argon-high", name: "Gemini 4 Argon (High)", isDefault: false },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", isDefault: true },
    ],
  );
  assert.deepEqual(
    parseAntigravityModels("Error: Please sign in to view available models. Launch the CLI."),
    [],
  );
  const id = "e2a61656-4261-492f-a81a-e1436fdbcad1";
  assert.deepEqual(
    parseAntigravityStreamLine(
      `{"event":"init","conversation_id":"${id}","init":{"model":"m","tools":["run_command"]}}`,
    ),
    { kind: "init", conversationId: id, model: "m" },
  );
  assert.deepEqual(
    parseAntigravityStreamLine(
      `{"event":"step_update","step_update":{"conversation_id":"${id}","step_type":"agent_response","text_delta":"Olá"}}`,
    ),
    { kind: "delta", conversationId: id, text: "Olá" },
  );
  assert.deepEqual(
    parseAntigravityStreamLine(
      '{"event":"step_update","step_update":{"step_type":"user_input","text_delta":"x"}}',
    ),
    { kind: "step", conversationId: null },
  );
  assert.deepEqual(
    parseAntigravityStreamLine(
      '{"event":"step_update","step_update":{"step_type":"tool","tool_name":"view_file"}}',
    ),
    { kind: "tool", conversationId: null, name: "view_file" },
  );
  assert.deepEqual(parseAntigravityStreamLine('{"event":"result","result":{"status":"SUCCESS"}}'), {
    kind: "result",
    conversationId: null,
    payload: { status: "SUCCESS" },
  });
  assert.equal(parseAntigravityStreamLine("not json"), null);
  assert.deepEqual(structuredOutput({ response: 'Aqui está:\n```json\n{"a":1}\n```' }), { a: 1 });
  assert.equal(structuredOutput({ response: "sem json" }), undefined);
});

test("the Antigravity sign-in runs inside a terminal on each platform", () => {
  assert.deepEqual(inTerminal("darwin", "agy", ["--print", "ok"]), {
    command: "bash",
    args: ["-c", 'script -q /dev/null "$@" < <(cat)', "bash", "agy", "--print", "ok"],
  });
  assert.deepEqual(inTerminal("linux", "agy", ["--print", "it's ok"]), {
    command: "script",
    args: ["-q", "-e", "-c", "'agy' '--print' 'it'\\''s ok'", "/dev/null"],
  });
});

async function withFakeAntigravity(
  stream: string[],
  use: (adapter: ProviderAdapter, workDirectory: string, argsFile: string) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openmonetis-agy-"));
  const command = path.join(directory, "agy");
  const argsFile = path.join(directory, "args.json");
  const workDirectory = path.join(directory, "run");
  await writeFile(
    command,
    [
      "#!/usr/bin/env node",
      `if (process.argv[2] === "models") { console.log("gemini-flash   Gemini Flash"); process.exit(0); }`,
      `require("node:fs").writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));`,
      // Like the real CLI, every run leaves its conversation in the home.
      `const store = require("node:path").join(process.env.HOME, ".gemini", "antigravity-cli");`,
      `require("node:fs").mkdirSync(require("node:path").join(store, "brain", "conv-0001-abcd"), { recursive: true });`,
      `require("node:fs").mkdirSync(require("node:path").join(store, "brain", "other-conversation"), { recursive: true });`,
      `for (const line of ${JSON.stringify(stream)}) console.log(line);`,
    ].join("\n"),
  );
  await chmod(command, 0o755);
  await mkdir(workDirectory);
  try {
    await use(createAntigravityProvider(command, "linux"), workDirectory, argsFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("an Antigravity run answers from a tool-less agent that holds the data", async () => {
  await withFakeAntigravity(
    [
      '{"event":"init","conversation_id":"conv-0001-abcd","init":{"tools":["run_command"]}}',
      '{"event":"result","result":{"conversation_id":"conv-0001-abcd","status":"SUCCESS","response":"```json\\n{\\"score\\":80}\\n```"}}',
    ],
    async (adapter, workDirectory, argsFile) => {
      const result = await adapter.run(workDirectory, {
        instructions: "Seja breve.",
        prompt: "Dados: saldo 100",
        schema: { type: "object" },
        model: "gemini-flash",
        workDirectory,
      });
      assert.deepEqual(result, {
        status: "completed",
        output: { score: 80 },
        model: { id: "gemini-flash", name: "Gemini Flash" },
      });
      const agent = await readFile(
        path.join(workDirectory, "workspace", ".agents", "agents", "openmonetis.md"),
        "utf8",
      );
      assert.match(agent, /tools: \[\]/);
      assert.match(agent, /excludeDefaultComponents: true/);
      assert.match(agent, /Seja breve\.\n\nResponda somente com um objeto JSON válido/);
      assert.match(agent, /\{"type":"object"\}\n\nDados: saldo 100/);
      const args = JSON.parse(await readFile(argsFile, "utf8")) as string[];
      assert.ok(args.includes("--agent"));
      assert.ok(!args.some((arg) => arg.includes("saldo 100")));
      const brain = path.join(workDirectory, ".gemini", "antigravity-cli", "brain");
      await assert.rejects(stat(path.join(brain, "conv-0001-abcd")));
      await stat(path.join(brain, "other-conversation"));
    },
  );
});

test("an Antigravity run that calls a tool is stopped before it answers", async () => {
  await withFakeAntigravity(
    [
      '{"event":"init","init":{"tools":["run_command"]}}',
      '{"event":"step_update","step_update":{"step_type":"tool","tool_name":"run_command"}}',
      '{"event":"result","result":{"status":"SUCCESS","response":"oi"}}',
    ],
    async (adapter, workDirectory) => {
      const deltas: string[] = [];
      const result = await adapter.chat(
        workDirectory,
        { instructions: "", prompt: "Oi", model: null, workDirectory },
        (event) => deltas.push(event.type),
      );
      assert.deepEqual(result, { status: "failed", code: "runFailed" });
    },
  );
});

test("an Antigravity chat streams deltas and ends with the final response", async () => {
  await withFakeAntigravity(
    [
      '{"event":"init","init":{"tools":[]}}',
      '{"event":"step_update","step_update":{"step_type":"user_input"}}',
      '{"event":"step_update","step_update":{"step_type":"agent_response","text_delta":"Seu "}}',
      '{"event":"step_update","step_update":{"step_type":"agent_response","text_delta":"saldo subiu."}}',
      '{"event":"result","result":{"status":"SUCCESS","response":"Seu saldo subiu."}}',
    ],
    async (adapter, workDirectory) => {
      const deltas: string[] = [];
      const result = await adapter.chat(
        workDirectory,
        { instructions: "", prompt: "Oi", model: null, workDirectory },
        (event) => {
          if (event.type === "delta") deltas.push(event.text);
        },
      );
      assert.deepEqual(deltas, ["Seu ", "saldo subiu."]);
      assert.deepEqual(result, { status: "completed", text: "Seu saldo subiu.", model: null });
    },
  );
});

test("vendor telemetry, error reports and feedback stay off in every CLI run", () => {
  assert.deepEqual(claudePrivacyEnvironment, {
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_BUG_COMMAND: "1",
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  });
  assert.ok(subscriptionConfig.includes("analytics.enabled=false"));
  assert.ok(subscriptionConfig.includes("feedback.enabled=false"));
  assert.ok(toolsOffConfig.includes("features.shell_tool=false"));
  assert.ok(toolsOffConfig.includes('web_search="disabled"'));
});

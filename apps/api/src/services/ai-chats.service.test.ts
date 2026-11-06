import assert from "node:assert/strict";
import test from "node:test";
import { createCategoryAliases } from "@openmonetis/domain/ai-data-sharing";
import type { AiChatStreamEvent } from "@openmonetis/validators/ai-chats";
import { ApiError } from "../utils/errors";
import {
  type AiChatMessageRecord,
  type AiChatRecord,
  type AiChatRunEvent,
  type AiChatsRepository,
  createAiChatsService,
} from "./ai-chats.service";
import type { AiFinancialContextReader } from "./ai-context.service";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-06-15T12:00:00.000Z");

function createRepository() {
  const chats: AiChatRecord[] = [];
  const messages: AiChatMessageRecord[] = [];
  let sequence = 0;
  const nextId = () => {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  };
  const streaming = (id: string) =>
    messages.find((message) => message.id === id && message.status === "streaming");

  const repository: AiChatsRepository = {
    listByUser: async (owner) => chats.filter((chat) => chat.userId === owner),
    findByIdForUser: async (id, owner) =>
      chats.find((chat) => chat.id === id && chat.userId === owner) ?? null,
    async insertChat(data) {
      const chat = { ...data, id: nextId(), createdAt: now, updatedAt: now };
      chats.push(chat);
      return chat;
    },
    async updateChat(id, owner, changes) {
      const chat = chats.find((item) => item.id === id && item.userId === owner);
      if (chat) Object.assign(chat, changes);
      return chat ?? null;
    },
    async deleteChat(id, owner) {
      const index = chats.findIndex((chat) => chat.id === id && chat.userId === owner);
      if (index >= 0) chats.splice(index, 1);
      return index >= 0;
    },
    listMessages: async (chatId) => messages.filter((message) => message.chatId === chatId),
    async insertMessage(data) {
      const message: AiChatMessageRecord = {
        ...data,
        id: nextId(),
        reasoning: null,
        failureCode: null,
        model: null,
        createdAt: now,
      };
      messages.push(message);
      return message;
    },
    async completeMessage(id, _owner, data) {
      const message = streaming(id);
      if (message) Object.assign(message, data, { status: "completed" });
      return message ?? null;
    },
    async settleMessage(id, _owner, data) {
      const message = streaming(id);
      if (message) Object.assign(message, data);
      return message ?? null;
    },
    async deleteMessage(id) {
      const index = messages.findIndex((message) => message.id === id);
      if (index >= 0) messages.splice(index, 1);
    },
    countUserMessagesSince: async (owner) =>
      messages.filter((message) => message.role === "user" && chats.some((c) => c.userId === owner))
        .length,
  };
  return { chats, messages, repository };
}

const context: AiFinancialContextReader = {
  load: async () =>
    ({
      healthInput: {
        history: [],
        totalBalance: 0,
        expenseCategories: [],
        attention: { critical: 0, warning: 0 },
      },
    }) as unknown as Awaited<ReturnType<AiFinancialContextReader["load"]>>,
  async describe() {
    const aliases = createCategoryAliases(false);
    aliases.name("c-1", "Moradia");
    return {
      data: { categories: [{ name: "Categoria 1" }] },
      aliases,
      categoryIds: new Set(),
    } as unknown as Awaited<ReturnType<AiFinancialContextReader["describe"]>>;
  },
};

function createService(
  run: (prompt: string, signal: AbortSignal) => AsyncIterable<AiChatRunEvent>,
) {
  const store = createRepository();
  const prompts: string[] = [];
  const instructions: string[] = [];
  const service = createAiChatsService({
    repository: store.repository,
    context,
    providers: { prepareRun: async (_owner, _provider, model) => ({ model: model ?? null }) },
    dataSharing: { scopesFor: async () => [] },
    runner: {
      chat: (_owner, _provider, input, signal) => {
        prompts.push(input.prompt);
        instructions.push(input.instructions);
        return run(input.prompt, signal);
      },
    },
    now: () => now,
  });
  return { ...store, prompts, instructions, service };
}

async function collect(events: AsyncIterable<AiChatStreamEvent>) {
  const collected: AiChatStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

const signal = () => new AbortController().signal;

async function* answer(...events: AiChatRunEvent[]) {
  for (const event of events) yield event;
}

test("a question streams a reply with real category names and is saved with its model", async () => {
  const { service, messages, prompts } = createService(() =>
    answer(
      { type: "reasoning", text: "Olhando a Categ" },
      { type: "reasoning", text: "oria 1" },
      { type: "delta", text: "A Categ" },
      { type: "delta", text: "oria 1 pesa mais." },
      {
        type: "completed",
        text: "A Categoria 1 pesa mais.",
        model: { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
      },
    ),
  );
  const chat = await service.create(userId, { period: "2026-06", provider: "claude" });
  const events = await collect(
    await service.send(
      userId,
      chat.id,
      { content: "Onde estou gastando mais?", provider: "claude" },
      signal(),
    ),
  );

  assert.equal(events[0]?.type, "start");
  assert.equal(events[0]?.type === "start" && events[0].chat.title, "Onde estou gastando mais?");
  const text = events.flatMap((event) => (event.type === "delta" ? [event.text] : [])).join("");
  assert.equal(text, "A Moradia pesa mais.");
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  assert.equal(done?.type === "done" && done.message.content, "A Moradia pesa mais.");
  assert.equal(done?.type === "done" && done.message.reasoning, "Olhando a Moradia");
  assert.deepEqual(done?.type === "done" && done.message.model, {
    id: "claude-sonnet-5-5",
    name: "Sonnet 5.5",
  });
  assert.deepEqual(
    messages.map((message) => [message.role, message.status]),
    [
      ["user", "completed"],
      ["assistant", "completed"],
    ],
  );
  assert.match(prompts[0] ?? "", /Categoria 1/);
  assert.doesNotMatch(prompts[0] ?? "", /Moradia/);
  assert.match(prompts[0] ?? "", /Onde estou gastando mais\?/);
});

test("stopping keeps the partial reply as canceled", async () => {
  const controller = new AbortController();
  const { service, messages } = createService((_prompt, runSignal) =>
    (async function* () {
      yield { type: "delta", text: "Começando" } as AiChatRunEvent;
      controller.abort();
      if (runSignal.aborted) throw new DOMException("Aborted", "AbortError");
    })(),
  );
  const chat = await service.create(userId, { period: "2026-06", provider: "codex" });
  await collect(
    await service.send(userId, chat.id, { content: "Oi", provider: "codex" }, controller.signal),
  );
  const reply = messages.find((message) => message.role === "assistant");
  assert.equal(reply?.status, "canceled");
  assert.equal(reply?.content, "Começando");
});

test("a client that leaves mid-reply also cancels it", async () => {
  const { service, messages } = createService(() =>
    answer({ type: "delta", text: "Parte" }, { type: "delta", text: " dois" }),
  );
  const chat = await service.create(userId, { period: "2026-06", provider: "codex" });
  const events = await service.send(
    userId,
    chat.id,
    { content: "Oi", provider: "codex" },
    signal(),
  );
  await events.next();
  await events.next();
  await events.return(undefined);
  assert.equal(messages.find((message) => message.role === "assistant")?.status, "canceled");
});

test("provider failures and an unreachable service end as failed replies", async () => {
  const limited = createService(() => answer({ type: "failed", code: "providerLimitReached" }));
  const chat = await limited.service.create(userId, { period: "2026-06", provider: "claude" });
  const events = await collect(
    await limited.service.send(userId, chat.id, { content: "Oi", provider: "claude" }, signal()),
  );
  const done = events.at(-1);
  assert.equal(done?.type === "done" && done.message.failureCode, "providerLimitReached");

  const offline = createService(() =>
    (async function* () {
      yield* [];
      throw new Error("offline");
    })(),
  );
  const offlineChat = await offline.service.create(userId, {
    period: "2026-06",
    provider: "claude",
  });
  const offlineEvents = await collect(
    await offline.service.send(
      userId,
      offlineChat.id,
      { content: "Oi", provider: "claude" },
      signal(),
    ),
  );
  const offlineDone = offlineEvents.at(-1);
  assert.equal(
    offlineDone?.type === "done" && offlineDone.message.failureCode,
    "serviceUnavailable",
  );
});

test("one reply at a time per chat, and chats are private to their owner", async () => {
  const { service, messages } = createService(() => answer());
  const chat = await service.create(userId, { period: "2026-06", provider: "claude" });
  messages.push({
    id: "00000000-0000-4000-8000-0000000000ff",
    chatId: chat.id,
    role: "assistant",
    content: "",
    reasoning: null,
    status: "streaming",
    failureCode: null,
    provider: "claude",
    model: null,
    sharedScopes: [],
    createdAt: now,
    completedAt: null,
  });
  await assert.rejects(
    service.send(userId, chat.id, { content: "Oi", provider: "claude" }, signal()),
    (error) => error instanceof ApiError && error.code === "ai_chat_busy",
  );
  await assert.rejects(
    service.get(chat.id, otherUserId),
    (error) => error instanceof ApiError && error.code === "ai_chat_not_found",
  );
});

test("regenerating replaces the last answer and keeps the question", async () => {
  let call = 0;
  const { service, messages } = createService(() => {
    call += 1;
    return answer({ type: "completed", text: `Resposta ${call}`, model: null });
  });
  const chat = await service.create(userId, { period: "2026-06", provider: "claude" });
  await collect(
    await service.send(userId, chat.id, { content: "Pergunta", provider: "claude" }, signal()),
  );
  await collect(await service.regenerate(userId, chat.id, { provider: "codex" }, signal()));

  assert.deepEqual(
    messages.map((message) => [message.role, message.content]),
    [
      ["user", "Pergunta"],
      ["assistant", "Resposta 2"],
    ],
  );
  assert.equal((await service.get(chat.id, userId)).provider, "codex");
  const empty = await service.create(userId, { period: "2026-06", provider: "claude" });
  await assert.rejects(
    service.regenerate(userId, empty.id, { provider: "claude" }, signal()),
    (error) => error instanceof ApiError && error.code === "ai_chat_nothing_to_regenerate",
  );
});

test("a reply follows the chosen voice in the whole answer", async () => {
  const { service, instructions } = createService(() =>
    answer({ type: "completed", text: "Ok.", model: null }),
  );
  const chat = await service.create(userId, { period: "2026-06", provider: "claude" });
  await collect(
    await service.send(userId, chat.id, { content: "Como estou?", provider: "claude" }, signal()),
  );
  await collect(
    await service.regenerate(userId, chat.id, { provider: "claude", voice: "sarcastic" }, signal()),
  );

  assert.match(instructions[0] ?? "", /warm and honest/);
  assert.match(instructions[1] ?? "", /dry, good-humored irony/);
  assert.match(instructions[1] ?? "", /Keep the voice in the whole text/);
  for (const text of instructions) assert.match(text, /Never mock, insult or judge the person/);
});

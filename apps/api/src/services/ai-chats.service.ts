import {
  type AiChatFailureCode,
  type AiChatMessageRole,
  type AiChatMessageStatus,
  aiChatDailyMessageLimit,
  aiChatListLimit,
  deriveAiChatTitle,
  isAiChatStreamingExpired,
  selectAiChatHistory,
} from "@openmonetis/domain/ai-chats";
import type { AiDataScope } from "@openmonetis/domain/ai-data-sharing";
import {
  type AiDiagnosisVoice,
  calculateFinancialHealth,
  defaultAiDiagnosisVoice,
} from "@openmonetis/domain/ai-diagnoses";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type {
  AiChatMessageOutput,
  AiChatOutput,
  AiChatStreamEvent,
  AiChatSummaryOutput,
  AiChatsOutput,
  CreateAiChatInput,
  RegenerateAiChatReplyInput,
  SendAiChatMessageInput,
  UpdateAiChatInput,
} from "@openmonetis/validators/ai-chats";
import { aiVoiceInstructions } from "../utils/ai-voices";
import { badRequest, conflict, notFound } from "../utils/errors";
import {
  type AiDataSharingReader,
  type AiFinancialContextReader,
  aiPeriodInstructions,
} from "./ai-context.service";

const dailyWindowMs = 24 * 60 * 60_000;
const newChatTitle = "Nova conversa";

export type AiChatUsedModel = { id: string; name: string };

export type AiChatRecord = {
  id: string;
  userId: string;
  title: string;
  period: string;
  provider: AiProvider;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AiChatMessageRecord = {
  id: string;
  chatId: string;
  role: AiChatMessageRole;
  content: string;
  reasoning: string | null;
  status: AiChatMessageStatus;
  failureCode: AiChatFailureCode | null;
  provider: AiProvider | null;
  model: AiChatUsedModel | null;
  sharedScopes: AiDataScope[];
  createdAt: Date;
  completedAt: Date | null;
};

type SettledMessage = {
  status: Extract<AiChatMessageStatus, "failed" | "canceled">;
  failureCode: AiChatFailureCode | null;
  content: string;
  reasoning: string | null;
  completedAt: Date;
};

export type AiChatsRepository = {
  listByUser(userId: string, limit: number): Promise<AiChatRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<AiChatRecord | null>;
  insertChat(data: {
    userId: string;
    title: string;
    period: string;
    provider: AiProvider;
    model: string | null;
  }): Promise<AiChatRecord>;
  updateChat(
    id: string,
    userId: string,
    changes: Partial<Pick<AiChatRecord, "title" | "provider" | "model" | "updatedAt">>,
  ): Promise<AiChatRecord | null>;
  deleteChat(id: string, userId: string): Promise<boolean>;
  listMessages(chatId: string, userId: string): Promise<AiChatMessageRecord[]>;
  insertMessage(data: {
    chatId: string;
    userId: string;
    role: AiChatMessageRole;
    content: string;
    status: AiChatMessageStatus;
    provider: AiProvider | null;
    sharedScopes: AiDataScope[];
    completedAt: Date | null;
  }): Promise<AiChatMessageRecord>;
  completeMessage(
    id: string,
    userId: string,
    data: {
      content: string;
      reasoning: string | null;
      model: AiChatUsedModel | null;
      completedAt: Date;
    },
  ): Promise<AiChatMessageRecord | null>;
  settleMessage(
    id: string,
    userId: string,
    data: SettledMessage,
  ): Promise<AiChatMessageRecord | null>;
  deleteMessage(id: string, userId: string): Promise<void>;
  countUserMessagesSince(userId: string, since: Date): Promise<number>;
};

export type AiChatProviderChecker = {
  prepareRun(
    userId: string,
    provider: AiProvider,
    requestedModel?: string | null,
  ): Promise<{ model: string | null }>;
};

export type AiChatRunEvent =
  | { type: "delta"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "completed"; text: string; model: AiChatUsedModel | null }
  | {
      type: "failed";
      code: Exclude<AiChatFailureCode, "serviceUnavailable" | "interrupted"> | "canceled";
    };

export type AiChatRunner = {
  chat(
    userId: string,
    provider: AiProvider,
    input: { instructions: string; prompt: string; model: string | null },
    signal: AbortSignal,
  ): AsyncIterable<AiChatRunEvent>;
};

type ReplyRun = {
  provider: AiProvider;
  model: string | null;
  scopes: AiDataScope[];
  voice: AiDiagnosisVoice;
};

function chatInstructions(voice: AiDiagnosisVoice) {
  return [
    "You are the financial assistant of OpenMonetis, a personal finance manager, chatting with the user.",
    "Always answer in Brazilian Portuguese (pt-BR) using Markdown: short paragraphs, and lists or",
    "tables when they help. Write amounts in BRL as R$ 1.234,56.",
    ...aiVoiceInstructions(voice),
    "The voice changes only the wording: numbers and how serious a problem is stay the same in",
    "every voice. Examples only show the style; never reuse their values.",
    "Never mock, insult or judge the person, their income or their intelligence, never use",
    "profanity and never comment on other people named in the data.",
    "Use only the financial data provided and the conversation. Never invent numbers and never claim",
    "to have changed any data. If the data does not answer the question, say so plainly and point",
    "to where in OpenMonetis the user can check.",
    "You have no tools: you cannot run commands, read files, browse or call any service. Never write",
    "tool calls or command output; if asked to, say you only answer from the data provided.",
    "Present suggestions as general guidance, never as professional investment, tax or legal advice.",
    "Category names may be placeholders such as 'Categoria 1'; write them exactly as given.",
    "Optional blocks (transactions, accounts, cards, budgets, goals) appear only when the user allowed",
    "them in Ajustes › Integrações; if a question needs one that is missing, say which permission",
    "would provide it.",
    ...aiPeriodInstructions,
  ].join("\n");
}

export function createAiChatsService(dependencies: {
  repository: AiChatsRepository;
  context: AiFinancialContextReader;
  providers: AiChatProviderChecker;
  runner: AiChatRunner;
  dataSharing: AiDataSharingReader;
  now?: () => Date;
}) {
  const { repository, context, providers, runner, dataSharing } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  async function ownedChat(id: string, userId: string) {
    const chat = await repository.findByIdForUser(id, userId);
    if (!chat) throw notFound("Chat not found", "ai_chat_not_found");
    return chat;
  }

  /** Replies left streaming by a lost connection or a restart are settled as interrupted. */
  async function messagesOf(chat: AiChatRecord) {
    const messages = await repository.listMessages(chat.id, chat.userId);
    return Promise.all(
      messages.map(async (message) =>
        message.status === "streaming" && isAiChatStreamingExpired(message.createdAt, now())
          ? ((await repository.settleMessage(message.id, chat.userId, {
              status: "failed",
              failureCode: "interrupted",
              content: message.content,
              reasoning: message.reasoning,
              completedAt: now(),
            })) ?? message)
          : message,
      ),
    );
  }

  async function requireIdle(chat: AiChatRecord) {
    const messages = await messagesOf(chat);
    if (messages.some((message) => message.status === "streaming")) {
      throw conflict("A reply is still being written", "ai_chat_busy");
    }
    return messages;
  }

  async function prepareReply(chat: AiChatRecord, input: RegenerateAiChatReplyInput) {
    const { model } = await providers.prepareRun(chat.userId, input.provider, input.model);
    const scopes = await dataSharing.scopesFor(chat.userId);
    return {
      provider: input.provider,
      model,
      scopes,
      voice: input.voice ?? defaultAiDiagnosisVoice,
    } satisfies ReplyRun;
  }

  async function startReply(
    chat: AiChatRecord,
    conversation: AiChatMessageRecord[],
    userMessage: AiChatMessageRecord | null,
    run: ReplyRun,
    signal: AbortSignal,
  ) {
    const assistant = await repository.insertMessage({
      chatId: chat.id,
      userId: chat.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      provider: run.provider,
      sharedScopes: run.scopes,
      completedAt: null,
    });
    return streamReply(chat, conversation, userMessage, assistant, run, signal);
  }

  async function* streamReply(
    chat: AiChatRecord,
    conversation: AiChatMessageRecord[],
    userMessage: AiChatMessageRecord | null,
    assistant: AiChatMessageRecord,
    run: ReplyRun,
    signal: AbortSignal,
  ): AsyncGenerator<AiChatStreamEvent> {
    yield {
      type: "start",
      chat: toChatSummary(chat),
      userMessage: userMessage ? toMessageOutput(userMessage) : null,
      assistantMessage: toMessageOutput(assistant),
    };

    let content = "";
    let reasoning = "";
    let settled = false;
    const settle = async (
      status: SettledMessage["status"],
      failureCode: AiChatFailureCode | null,
    ) => {
      settled = true;
      const message = await repository.settleMessage(assistant.id, chat.userId, {
        status,
        failureCode,
        content,
        reasoning: reasoning || null,
        completedAt: now(),
      });
      return toMessageOutput(message ?? assistant);
    };

    try {
      const loaded = await context.load(chat.userId, chat.period);
      const health = calculateFinancialHealth(loaded.healthInput);
      const described = await context.describe({
        userId: chat.userId,
        period: chat.period,
        health,
        scopes: run.scopes,
        loaded,
      });
      const text = described.aliases.createStream();
      const thoughts = described.aliases.createStream();
      const events = runner.chat(
        chat.userId,
        run.provider,
        {
          instructions: chatInstructions(run.voice),
          prompt: buildPrompt(chat, described.data, conversation),
          model: run.model,
        },
        signal,
      );

      for await (const event of events) {
        if (event.type === "delta" || event.type === "reasoning") {
          const restored = (event.type === "delta" ? text : thoughts).push(event.text);
          if (!restored) continue;
          if (event.type === "delta") content += restored;
          else reasoning += restored;
          yield { type: event.type, text: restored };
          continue;
        }
        if (event.type === "failed") {
          content += text.flush();
          reasoning += thoughts.flush();
          const message = await settle(
            event.code === "canceled" ? "canceled" : "failed",
            event.code === "canceled" ? null : event.code,
          );
          yield { type: "done", message };
          return;
        }

        const tail = text.flush();
        if (tail) {
          content += tail;
          yield { type: "delta", text: tail };
        }
        reasoning += thoughts.flush();
        settled = true;
        const completed = await repository.completeMessage(assistant.id, chat.userId, {
          content: described.aliases.restore(event.text) || content,
          reasoning: reasoning || null,
          model: event.model,
          completedAt: now(),
        });
        yield { type: "done", message: toMessageOutput(completed ?? assistant) };
        return;
      }

      yield { type: "done", message: await settle("failed", "runFailed") };
    } catch (error) {
      if (signal.aborted) {
        await settle("canceled", null);
        return;
      }
      console.error("AI chat reply failed", error);
      yield { type: "done", message: await settle("failed", "serviceUnavailable") };
    } finally {
      // The client went away before the reply ended; keep what was written.
      if (!settled) await settle("canceled", null);
    }
  }

  return {
    async list(userId: string): Promise<AiChatsOutput> {
      const chats = await repository.listByUser(userId, aiChatListLimit);
      return { items: chats.map(toChatSummary) };
    },

    async get(id: string, userId: string): Promise<AiChatOutput> {
      const chat = await ownedChat(id, userId);
      const messages = await messagesOf(chat);
      return { ...toChatSummary(chat), messages: messages.map(toMessageOutput) };
    },

    async create(userId: string, input: CreateAiChatInput): Promise<AiChatOutput> {
      const { model } = await providers.prepareRun(userId, input.provider, input.model);
      const chat = await repository.insertChat({
        userId,
        title: newChatTitle,
        period: input.period,
        provider: input.provider,
        model,
      });
      return { ...toChatSummary(chat), messages: [] };
    },

    async update(
      id: string,
      userId: string,
      input: UpdateAiChatInput,
    ): Promise<AiChatSummaryOutput> {
      const chat = await repository.updateChat(id, userId, { title: input.title });
      if (!chat) throw notFound("Chat not found", "ai_chat_not_found");
      return toChatSummary(chat);
    },

    async delete(id: string, userId: string): Promise<{ id: string }> {
      if (!(await repository.deleteChat(id, userId))) {
        throw notFound("Chat not found", "ai_chat_not_found");
      }
      return { id };
    },

    /**
     * Saves the question and returns the reply as a stream of events. Every check runs before the
     * stream starts, so a refused message is a plain error response.
     */
    async send(userId: string, chatId: string, input: SendAiChatMessageInput, signal: AbortSignal) {
      const chat = await ownedChat(chatId, userId);
      const messages = await requireIdle(chat);
      const since = new Date(now().getTime() - dailyWindowMs);
      if ((await repository.countUserMessagesSince(userId, since)) >= aiChatDailyMessageLimit) {
        throw conflict("Daily chat limit reached", "ai_chat_daily_limit");
      }
      const run = await prepareReply(chat, input);

      const isFirstQuestion = !messages.some((message) => message.role === "user");
      const updated =
        (await repository.updateChat(chat.id, userId, {
          provider: run.provider,
          model: run.model,
          updatedAt: now(),
          ...(isFirstQuestion && chat.title === newChatTitle
            ? { title: deriveAiChatTitle(input.content) }
            : {}),
        })) ?? chat;
      const userMessage = await repository.insertMessage({
        chatId: chat.id,
        userId,
        role: "user",
        content: input.content,
        status: "completed",
        provider: null,
        sharedScopes: [],
        completedAt: now(),
      });
      return startReply(updated, [...messages, userMessage], userMessage, run, signal);
    },

    /** Writes a new answer to the last question, replacing the previous answer. */
    async regenerate(
      userId: string,
      chatId: string,
      input: RegenerateAiChatReplyInput,
      signal: AbortSignal,
    ) {
      const chat = await ownedChat(chatId, userId);
      const messages = await requireIdle(chat);
      const last = messages.at(-1);
      const conversation = last?.role === "assistant" ? messages.slice(0, -1) : messages;
      if (conversation.at(-1)?.role !== "user") {
        throw badRequest("There is no question to answer", "ai_chat_nothing_to_regenerate");
      }
      const run = await prepareReply(chat, input);
      if (last?.role === "assistant") await repository.deleteMessage(last.id, userId);
      const updated =
        (await repository.updateChat(chat.id, userId, {
          provider: run.provider,
          model: run.model,
          updatedAt: now(),
        })) ?? chat;
      return startReply(updated, conversation, null, run, signal);
    },
  };
}

export type AiChatsService = ReturnType<typeof createAiChatsService>;

/** Aggregates and allowed details for the chat month, then the recent turns, oldest first. */
function buildPrompt(chat: AiChatRecord, data: unknown, conversation: AiChatMessageRecord[]) {
  const history = selectAiChatHistory(conversation).map(({ role, content }) => ({ role, content }));
  return [
    `Financial data for ${chat.period} (JSON):`,
    JSON.stringify(data),
    "",
    "Conversation so far (JSON, oldest first):",
    JSON.stringify(history),
    "",
    "Reply to the last user message.",
  ].join("\n");
}

function toChatSummary(chat: AiChatRecord): AiChatSummaryOutput {
  return {
    id: chat.id,
    title: chat.title,
    period: chat.period,
    provider: chat.provider,
    model: chat.model,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

function toMessageOutput(message: AiChatMessageRecord): AiChatMessageOutput {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning,
    status: message.status,
    failureCode: message.failureCode,
    provider: message.provider,
    model: message.model,
    sharedScopes: message.sharedScopes,
    createdAt: message.createdAt.toISOString(),
    completedAt: message.completedAt?.toISOString() ?? null,
  };
}

import { aiChatMessages, aiChats, db } from "@openmonetis/db";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import type { AiChatMessageRecord, AiChatsRepository } from "../services/ai-chats.service";

const chatColumns = {
  id: aiChats.id,
  userId: aiChats.userId,
  title: aiChats.title,
  period: aiChats.period,
  provider: aiChats.provider,
  model: aiChats.model,
  createdAt: aiChats.createdAt,
  updatedAt: aiChats.updatedAt,
};

const messageColumns = {
  id: aiChatMessages.id,
  chatId: aiChatMessages.chatId,
  role: aiChatMessages.role,
  content: aiChatMessages.content,
  reasoning: aiChatMessages.reasoning,
  status: aiChatMessages.status,
  failureCode: aiChatMessages.failureCode,
  provider: aiChatMessages.provider,
  modelId: aiChatMessages.modelId,
  modelName: aiChatMessages.modelName,
  sharedScopes: aiChatMessages.sharedScopes,
  createdAt: aiChatMessages.createdAt,
  completedAt: aiChatMessages.completedAt,
};

type MessageRow = { modelId: string | null; modelName: string | null } & Omit<
  AiChatMessageRecord,
  "model"
>;

function toMessage({ modelId, modelName, ...row }: MessageRow): AiChatMessageRecord {
  return { ...row, model: modelId ? { id: modelId, name: modelName ?? modelId } : null };
}

function ownedChat(id: string, userId: string) {
  return and(eq(aiChats.id, id), eq(aiChats.userId, userId));
}

function streamingMessage(id: string, userId: string) {
  return and(
    eq(aiChatMessages.id, id),
    eq(aiChatMessages.userId, userId),
    eq(aiChatMessages.status, "streaming"),
  );
}

export const aiChatsRepository = {
  async listByUser(userId, limit) {
    return db
      .select(chatColumns)
      .from(aiChats)
      .where(eq(aiChats.userId, userId))
      .orderBy(desc(aiChats.updatedAt), desc(aiChats.id))
      .limit(limit);
  },

  async findByIdForUser(id, userId) {
    const [chat] = await db.select(chatColumns).from(aiChats).where(ownedChat(id, userId)).limit(1);
    return chat ?? null;
  },

  async insertChat(data) {
    const [chat] = await db.insert(aiChats).values(data).returning(chatColumns);
    if (!chat) throw new Error("AI chat insert returned no row");
    return chat;
  },

  async updateChat(id, userId, changes) {
    const [chat] = await db
      .update(aiChats)
      .set(changes)
      .where(ownedChat(id, userId))
      .returning(chatColumns);
    return chat ?? null;
  },

  async deleteChat(id, userId) {
    const rows = await db
      .delete(aiChats)
      .where(ownedChat(id, userId))
      .returning({ id: aiChats.id });
    return rows.length > 0;
  },

  async listMessages(chatId, userId) {
    const rows = await db
      .select(messageColumns)
      .from(aiChatMessages)
      .where(and(eq(aiChatMessages.chatId, chatId), eq(aiChatMessages.userId, userId)))
      .orderBy(asc(aiChatMessages.createdAt), asc(aiChatMessages.id));
    return rows.map(toMessage);
  },

  async insertMessage(data) {
    const [row] = await db.insert(aiChatMessages).values(data).returning(messageColumns);
    if (!row) throw new Error("AI chat message insert returned no row");
    return toMessage(row);
  },

  async completeMessage(id, userId, data) {
    const [row] = await db
      .update(aiChatMessages)
      .set({
        status: "completed",
        content: data.content,
        reasoning: data.reasoning,
        modelId: data.model?.id ?? null,
        modelName: data.model?.name ?? null,
        completedAt: data.completedAt,
      })
      .where(streamingMessage(id, userId))
      .returning(messageColumns);
    return row ? toMessage(row) : null;
  },

  async settleMessage(id, userId, data) {
    const [row] = await db
      .update(aiChatMessages)
      .set(data)
      .where(streamingMessage(id, userId))
      .returning(messageColumns);
    return row ? toMessage(row) : null;
  },

  async deleteMessage(id, userId) {
    await db
      .delete(aiChatMessages)
      .where(and(eq(aiChatMessages.id, id), eq(aiChatMessages.userId, userId)));
  },

  async countUserMessagesSince(userId, since) {
    const [row] = await db
      .select({ value: count() })
      .from(aiChatMessages)
      .where(
        and(
          eq(aiChatMessages.userId, userId),
          eq(aiChatMessages.role, "user"),
          gte(aiChatMessages.createdAt, since),
        ),
      );
    return row?.value ?? 0;
  },
} satisfies AiChatsRepository;

import { aiChats, aiDataSharing, aiDiagnoses, db } from "@openmonetis/db";
import { and, eq, inArray, lt, notInArray, type SQL } from "drizzle-orm";
import type {
  AiDataRetentionGroup,
  AiDataSharingRepository,
} from "../services/ai-data-sharing.service";

const columns = {
  scopes: aiDataSharing.scopes,
  retentionDays: aiDataSharing.retentionDays,
  updatedAt: aiDataSharing.updatedAt,
};

/** Chats and diagnoses are deleted together; a chat's messages follow it by cascade. */
async function deleteHistoryWhere(chats: SQL | undefined, diagnoses: SQL | undefined) {
  return db.transaction(async (tx) => {
    const deletedChats = await tx.delete(aiChats).where(chats).returning({ id: aiChats.id });
    const deletedDiagnoses = await tx
      .delete(aiDiagnoses)
      .where(diagnoses)
      .returning({ id: aiDiagnoses.id });
    return { chats: deletedChats.length, diagnoses: deletedDiagnoses.length };
  });
}

function usersIn(group: AiDataRetentionGroup) {
  return group.kind === "chosen"
    ? db
        .select({ userId: aiDataSharing.userId })
        .from(aiDataSharing)
        .where(eq(aiDataSharing.retentionDays, group.days))
    : db.select({ userId: aiDataSharing.userId }).from(aiDataSharing);
}

export const aiDataSharingRepository = {
  async findByUser(userId) {
    const [row] = await db
      .select(columns)
      .from(aiDataSharing)
      .where(eq(aiDataSharing.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async save(userId, scopes) {
    const [row] = await db
      .insert(aiDataSharing)
      .values({ userId, scopes })
      .onConflictDoUpdate({ target: aiDataSharing.userId, set: { scopes, updatedAt: new Date() } })
      .returning(columns);
    if (!row) throw new Error("AI data sharing upsert returned no row");
    return row;
  },

  async saveRetention(userId, retentionDays) {
    const [row] = await db
      .insert(aiDataSharing)
      .values({ userId, retentionDays })
      .onConflictDoUpdate({
        target: aiDataSharing.userId,
        set: { retentionDays, updatedAt: new Date() },
      })
      .returning(columns);
    if (!row) throw new Error("AI data retention upsert returned no row");
    return row;
  },

  deleteHistory(userId) {
    return deleteHistoryWhere(eq(aiChats.userId, userId), eq(aiDiagnoses.userId, userId));
  },

  deleteHistoryBefore(group) {
    // People with a saved preference are in `ai_data_sharing`; everyone else follows the default.
    const users = usersIn(group);
    const chatsOf = group.kind === "chosen" ? inArray : notInArray;
    return deleteHistoryWhere(
      and(chatsOf(aiChats.userId, users), lt(aiChats.updatedAt, group.before)),
      and(chatsOf(aiDiagnoses.userId, users), lt(aiDiagnoses.createdAt, group.before)),
    );
  },
} satisfies AiDataSharingRepository;

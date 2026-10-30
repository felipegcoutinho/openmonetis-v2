import { db, recurringTransactionRuleTags, tags, transactionTags } from "@openmonetis/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { TagsRepository } from "../services/tags.service";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function listTagsByIdsForUser(ids: string[], userId: string) {
  if (!ids.length) return [];
  return db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, ids)));
}
export async function replaceTransactionTags(
  transaction: DatabaseTransaction,
  transactionId: string,
  userId: string,
  tagIds: string[],
) {
  await transaction
    .delete(transactionTags)
    .where(
      and(eq(transactionTags.transactionId, transactionId), eq(transactionTags.userId, userId)),
    );
  if (tagIds.length)
    await transaction
      .insert(transactionTags)
      .values(tagIds.map((tagId) => ({ transactionId, userId, tagId })));
}
export async function replaceRecurringRuleTags(
  transaction: DatabaseTransaction,
  recurringRuleId: string,
  userId: string,
  tagIds: string[],
) {
  await transaction
    .delete(recurringTransactionRuleTags)
    .where(
      and(
        eq(recurringTransactionRuleTags.recurringRuleId, recurringRuleId),
        eq(recurringTransactionRuleTags.userId, userId),
      ),
    );
  if (tagIds.length)
    await transaction
      .insert(recurringTransactionRuleTags)
      .values(tagIds.map((tagId) => ({ recurringRuleId, userId, tagId })));
}
export async function readRecurringRuleTagIds(
  transaction: DatabaseTransaction,
  recurringRuleId: string,
  userId: string,
) {
  const rows = await transaction
    .select({ tagId: recurringTransactionRuleTags.tagId })
    .from(recurringTransactionRuleTags)
    .where(
      and(
        eq(recurringTransactionRuleTags.recurringRuleId, recurringRuleId),
        eq(recurringTransactionRuleTags.userId, userId),
      ),
    );
  return rows.map((row) => row.tagId);
}
export const tagsRepository: TagsRepository = {
  listForUser(userId) {
    return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name));
  },
  async createForUser(userId, name, nameKey, color) {
    const [tag] = await db
      .insert(tags)
      .values({ userId, name, nameKey, color })
      .onConflictDoNothing()
      .returning();
    return tag ?? null;
  },
  async updateForUser(id, userId, changes) {
    try {
      const [tag] = await db
        .update(tags)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(tags.id, id), eq(tags.userId, userId)))
        .returning();
      return tag ?? null;
    } catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if (cause.code === "23505" || cause.cause?.code === "23505") return "duplicate";
      throw error;
    }
  },
  async deleteForUser(id, userId) {
    const [tag] = await db
      .delete(tags)
      .where(and(eq(tags.id, id), eq(tags.userId, userId)))
      .returning({ id: tags.id });
    return Boolean(tag);
  },
};

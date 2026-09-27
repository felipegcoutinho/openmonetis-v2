import { db, financialAccounts, goals } from "@openmonetis/db";
import { and, asc, eq } from "drizzle-orm";
import type { GoalsRepository } from "../services/goals.service";

const goalColumns = {
  id: goals.id,
  userId: goals.userId,
  name: goals.name,
  targetAmount: goals.targetAmount,
  currentAmount: goals.currentAmount,
  targetDate: goals.targetDate,
  trackingType: goals.trackingType,
  accountId: goals.accountId,
  accountName: financialAccounts.name,
  accountLogo: financialAccounts.logo,
  status: goals.status,
  createdAt: goals.createdAt,
  updatedAt: goals.updatedAt,
};

async function findByIdForUser(id: string, userId: string) {
  const [goal] = await db
    .select(goalColumns)
    .from(goals)
    .leftJoin(
      financialAccounts,
      and(eq(goals.accountId, financialAccounts.id), eq(financialAccounts.userId, userId)),
    )
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .limit(1);
  return goal ?? null;
}

export const goalsRepository = {
  listByUser(userId) {
    return db
      .select(goalColumns)
      .from(goals)
      .leftJoin(
        financialAccounts,
        and(eq(goals.accountId, financialAccounts.id), eq(financialAccounts.userId, userId)),
      )
      .where(eq(goals.userId, userId))
      .orderBy(asc(goals.createdAt));
  },
  findByIdForUser,
  async findAccountForUser(id, userId) {
    const [account] = await db
      .select({ id: financialAccounts.id, isArchived: financialAccounts.isArchived })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
      .limit(1);
    return account ?? null;
  },
  async insert(data) {
    const [goal] = await db.insert(goals).values(data).returning({ id: goals.id });
    if (!goal) throw new Error("Goal insert returned no row");
    const inserted = await findByIdForUser(goal.id, data.userId);
    if (!inserted) throw new Error("Inserted goal could not be read");
    return inserted;
  },
  async updateForUser(id, userId, data) {
    const [goal] = await db
      .update(goals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return goal ? findByIdForUser(goal.id, userId) : null;
  },
  async deleteForUser(id, userId) {
    const [goal] = await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return goal ?? null;
  },
} satisfies GoalsRepository;

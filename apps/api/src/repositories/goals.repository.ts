import { db, financialAccounts, goalContributions, goals } from "@openmonetis/db";
import { GoalContributionError } from "@openmonetis/domain/goals";
import { and, asc, desc, eq, sql } from "drizzle-orm";
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

const contributionColumns = {
  id: goalContributions.id,
  goalId: goalContributions.goalId,
  kind: goalContributions.kind,
  amount: goalContributions.amount,
  date: goalContributions.date,
  note: goalContributions.note,
  createdAt: goalContributions.createdAt,
};

type GoalTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

// The balance moves with each contribution in the same statement, so concurrent writes cannot
// lose an update; the non-negative check on `goals` rejects a withdrawal that a concurrent write
// left without funds.
async function goalBalanceWrite<T>(operation: (tx: GoalTransaction) => Promise<T>) {
  try {
    return await db.transaction(operation);
  } catch (error) {
    const wrapped = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const cause = wrapped.cause ?? wrapped;
    if (cause.code === "23514" && cause.constraint === "goals_current_nonnegative_check") {
      throw new GoalContributionError("goal_contribution_exceeds_balance");
    }
    throw error;
  }
}

async function moveGoalBalance(
  tx: GoalTransaction,
  goalId: string,
  userId: string,
  amount: string,
) {
  const [goal] = await tx
    .update(goals)
    .set({ currentAmount: sql`${goals.currentAmount} + ${amount}::numeric`, updatedAt: new Date() })
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning({ id: goals.id });
  return Boolean(goal);
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
  async insert(data, openingContribution) {
    const goal = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(goals).values(data).returning({ id: goals.id });
      if (!inserted) throw new Error("Goal insert returned no row");
      if (openingContribution) {
        await tx
          .insert(goalContributions)
          .values({ ...openingContribution, userId: data.userId, goalId: inserted.id });
      }
      return inserted;
    });
    const inserted = await findByIdForUser(goal.id, data.userId);
    if (!inserted) throw new Error("Inserted goal could not be read");
    return inserted;
  },
  async updateForUser(id, userId, data, adjustment) {
    const updated = await goalBalanceWrite(async (tx) => {
      const [goal] = await tx
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(goals.id, id), eq(goals.userId, userId)))
        .returning({ id: goals.id });
      if (!goal) return null;
      if (adjustment) {
        await tx.insert(goalContributions).values({ ...adjustment, userId, goalId: id });
        await moveGoalBalance(tx, id, userId, adjustment.amount);
      }
      return goal;
    });
    return updated ? findByIdForUser(updated.id, userId) : null;
  },
  async deleteForUser(id, userId) {
    const [goal] = await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return goal ?? null;
  },
  listContributions(goalId, userId) {
    return db
      .select(contributionColumns)
      .from(goalContributions)
      .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)))
      .orderBy(desc(goalContributions.date), desc(goalContributions.createdAt));
  },
  async findContributionForUser(id, goalId, userId) {
    const [contribution] = await db
      .select(contributionColumns)
      .from(goalContributions)
      .where(
        and(
          eq(goalContributions.id, id),
          eq(goalContributions.goalId, goalId),
          eq(goalContributions.userId, userId),
        ),
      )
      .limit(1);
    return contribution ?? null;
  },
  async insertContribution(data) {
    return goalBalanceWrite(async (tx) => {
      const [contribution] = await tx
        .insert(goalContributions)
        .values(data)
        .returning(contributionColumns);
      if (!contribution) throw new Error("Goal contribution insert returned no row");
      await moveGoalBalance(tx, data.goalId, data.userId, data.amount);
      return contribution;
    });
  },
  async deleteContribution(id, goalId, userId) {
    return goalBalanceWrite(async (tx) => {
      const [contribution] = await tx
        .delete(goalContributions)
        .where(
          and(
            eq(goalContributions.id, id),
            eq(goalContributions.goalId, goalId),
            eq(goalContributions.userId, userId),
          ),
        )
        .returning({ amount: goalContributions.amount });
      if (!contribution) return false;
      await moveGoalBalance(tx, goalId, userId, (-Number(contribution.amount)).toFixed(2));
      return true;
    });
  },
} satisfies GoalsRepository;

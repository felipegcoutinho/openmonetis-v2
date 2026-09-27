import {
  calculateGoalProgress,
  type GoalStatus,
  type GoalTrackingType,
  resolveGoalPaceStatus,
  shouldFreezeLinkedGoalBalance,
  shouldReadLinkedGoalBalance,
  snapshotLinkedGoalBalance,
} from "@openmonetis/domain/goals";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { CreateGoalInput, GoalOutput, UpdateGoalInput } from "@openmonetis/validators/goals";
import { badRequest, notFound } from "../utils/errors";

export type GoalRecord = {
  id: string;
  userId: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  trackingType: GoalTrackingType;
  accountId: string | null;
  accountName: string | null;
  accountLogo: string | null;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalsRepository = {
  listByUser(userId: string): Promise<GoalRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<GoalRecord | null>;
  findAccountForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; isArchived: boolean } | null>;
  insert(data: {
    userId: string;
    name: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string | null;
    trackingType: GoalTrackingType;
    accountId: string | null;
  }): Promise<GoalRecord>;
  updateForUser(
    id: string,
    userId: string,
    data: {
      name?: string;
      targetAmount?: string;
      currentAmount?: string;
      targetDate?: string | null;
      status?: GoalStatus;
    },
  ): Promise<GoalRecord | null>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
};

type AccountBalances = {
  getBalanceSnapshot(
    accountId: string,
    userId: string,
    period: string,
  ): Promise<{ persisted: number }>;
};

export function createGoalsService(
  repository: GoalsRepository,
  accountBalances: AccountBalances,
  today: () => string = getCurrentDateInBrazil,
) {
  async function output(goal: GoalRecord, userId: string): Promise<GoalOutput> {
    const currentAmount =
      goal.accountId && shouldReadLinkedGoalBalance(goal.trackingType, goal.status)
        ? (
            await accountBalances.getBalanceSnapshot(
              goal.accountId,
              userId,
              getCurrentPeriodInBrazil(),
            )
          ).persisted
        : Number(goal.currentAmount);
    const progress = calculateGoalProgress({
      targetAmount: Number(goal.targetAmount),
      currentAmount,
      createdDate: goal.createdAt.toISOString().slice(0, 10),
      targetDate: goal.targetDate,
      today: today(),
    });
    return {
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      ...progress,
      paceStatus: resolveGoalPaceStatus(goal.status, progress.paceStatus),
      targetDate: goal.targetDate,
      trackingType: goal.trackingType,
      accountId: goal.accountId,
      accountName: goal.accountName,
      accountLogo: goal.accountLogo,
      status: goal.status,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  return {
    async list(userId: string) {
      return Promise.all((await repository.listByUser(userId)).map((goal) => output(goal, userId)));
    },
    async get(id: string, userId: string) {
      const goal = await repository.findByIdForUser(id, userId);
      if (!goal) throw notFound("Goal not found", "goal_not_found");
      return output(goal, userId);
    },
    async create(input: CreateGoalInput, userId: string) {
      if (input.trackingType === "account") {
        const account = await repository.findAccountForUser(input.accountId, userId);
        if (!account || account.isArchived)
          throw notFound("Account not found", "account_not_found");
      }
      const goal = await repository.insert({
        userId,
        name: input.name,
        targetAmount: input.targetAmount.toFixed(2),
        currentAmount: input.trackingType === "manual" ? input.currentAmount.toFixed(2) : "0.00",
        targetDate: input.targetDate,
        trackingType: input.trackingType,
        accountId: input.trackingType === "account" ? input.accountId : null,
      });
      return output(goal, userId);
    },
    async update(id: string, userId: string, input: UpdateGoalInput) {
      const current = await repository.findByIdForUser(id, userId);
      if (!current) throw notFound("Goal not found", "goal_not_found");
      if (input.currentAmount !== undefined && current.trackingType !== "manual") {
        throw badRequest(
          "Linked goals follow their account balance",
          "linked_goal_amount_readonly",
        );
      }
      const frozenAmount =
        current.accountId &&
        shouldFreezeLinkedGoalBalance(current.trackingType, current.status, input.status)
          ? (
              await accountBalances.getBalanceSnapshot(
                current.accountId,
                userId,
                getCurrentPeriodInBrazil(),
              )
            ).persisted
          : undefined;
      const goal = await repository.updateForUser(id, userId, {
        name: input.name,
        targetAmount: input.targetAmount?.toFixed(2),
        currentAmount:
          frozenAmount !== undefined
            ? snapshotLinkedGoalBalance(frozenAmount)
            : input.currentAmount?.toFixed(2),
        targetDate: input.targetDate,
        status: input.status,
      });
      if (!goal) throw notFound("Goal not found", "goal_not_found");
      return output(goal, userId);
    },
    async remove(id: string, userId: string) {
      const goal = await repository.deleteForUser(id, userId);
      if (!goal) throw notFound("Goal not found", "goal_not_found");
      return goal;
    },
  };
}

export type GoalsService = ReturnType<typeof createGoalsService>;

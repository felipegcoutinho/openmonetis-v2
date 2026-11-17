import {
  assertGoalContributionRemovable,
  buildGoalContributionHistory,
  calculateGoalProgress,
  calculateGoalRequiredMonthlyAmount,
  createGoalBalanceAdjustmentDraft,
  createGoalContributionDraft,
  GoalContributionError,
  type GoalContributionKind,
  type GoalStatus,
  type GoalTrackingType,
  resolveGoalPaceStatus,
  shouldFreezeLinkedGoalBalance,
  shouldReadLinkedGoalBalance,
  snapshotLinkedGoalBalance,
} from "@openmonetis/domain/goals";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  CreatedGoalContributionOutput,
  CreateGoalContributionInput,
  CreateGoalInput,
  GoalContributionOutput,
  GoalContributionsOutput,
  GoalOutput,
  RemovedGoalContributionOutput,
  UpdateGoalInput,
} from "@openmonetis/validators/goals";
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

export type GoalContributionRecord = {
  id: string;
  goalId: string;
  kind: GoalContributionKind;
  amount: string;
  date: string;
  note: string | null;
  createdAt: Date;
};

type GoalContributionWrite = {
  kind: GoalContributionKind;
  amount: string;
  date: string;
  note?: string | null;
};

export type GoalsRepository = {
  listByUser(userId: string): Promise<GoalRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<GoalRecord | null>;
  findAccountForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; isArchived: boolean } | null>;
  insert(
    data: {
      userId: string;
      name: string;
      targetAmount: string;
      currentAmount: string;
      targetDate: string | null;
      trackingType: GoalTrackingType;
      accountId: string | null;
    },
    openingContribution: GoalContributionWrite | null,
  ): Promise<GoalRecord>;
  /** `adjustment` is recorded and applied to the balance in the same transaction. */
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
    adjustment: GoalContributionWrite | null,
  ): Promise<GoalRecord | null>;
  deleteForUser(id: string, userId: string): Promise<{ id: string } | null>;
  listContributions(goalId: string, userId: string): Promise<GoalContributionRecord[]>;
  findContributionForUser(
    id: string,
    goalId: string,
    userId: string,
  ): Promise<GoalContributionRecord | null>;
  /** Records the contribution and moves the goal balance by its signed amount. */
  insertContribution(
    data: GoalContributionWrite & { userId: string; goalId: string },
  ): Promise<GoalContributionRecord>;
  /** Removes the contribution and reverts its effect on the goal balance. */
  deleteContribution(id: string, goalId: string, userId: string): Promise<boolean>;
};

type AccountBalances = {
  getBalanceSnapshot(
    accountId: string,
    userId: string,
    period: string,
  ): Promise<{ persisted: number }>;
};

function translateContributionError(error: unknown): never {
  if (!(error instanceof GoalContributionError)) throw error;
  switch (error.code) {
    case "goal_contributions_unavailable":
      throw badRequest(
        "Only active or paused manual goals accept contributions",
        "goal_contributions_unavailable",
      );
    case "goal_contribution_future_date":
      throw badRequest(
        "Contribution date cannot be in the future",
        "goal_contribution_future_date",
      );
    case "goal_contribution_exceeds_balance":
      throw badRequest(
        "The goal balance cannot become negative",
        "goal_contribution_exceeds_balance",
      );
  }
}

function contributionOutput(contribution: GoalContributionRecord): GoalContributionOutput {
  return {
    id: contribution.id,
    kind: contribution.kind,
    amount: Number(contribution.amount),
    date: contribution.date,
    note: contribution.note,
    createdAt: contribution.createdAt.toISOString(),
  };
}

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
    const businessDate = today();
    const progress = calculateGoalProgress({
      targetAmount: Number(goal.targetAmount),
      currentAmount,
      createdDate: goal.createdAt.toISOString().slice(0, 10),
      targetDate: goal.targetDate,
      today: businessDate,
    });
    return {
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      ...progress,
      paceStatus: resolveGoalPaceStatus(goal.status, progress.paceStatus),
      requiredMonthlyAmount:
        goal.status === "active"
          ? calculateGoalRequiredMonthlyAmount({
              targetAmount: Number(goal.targetAmount),
              currentAmount,
              targetDate: goal.targetDate,
              today: businessDate,
            })
          : null,
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

  async function findGoal(id: string, userId: string) {
    const goal = await repository.findByIdForUser(id, userId);
    if (!goal) throw notFound("Goal not found", "goal_not_found");
    return goal;
  }

  return {
    async list(userId: string) {
      return Promise.all((await repository.listByUser(userId)).map((goal) => output(goal, userId)));
    },
    async get(id: string, userId: string) {
      return output(await findGoal(id, userId), userId);
    },
    async create(input: CreateGoalInput, userId: string) {
      if (input.trackingType === "account") {
        const account = await repository.findAccountForUser(input.accountId, userId);
        if (!account || account.isArchived)
          throw notFound("Account not found", "account_not_found");
      }
      const openingContribution =
        input.trackingType === "manual"
          ? createGoalBalanceAdjustmentDraft({
              currentAmount: 0,
              desiredAmount: input.currentAmount,
              today: today(),
            })
          : null;
      const goal = await repository.insert(
        {
          userId,
          name: input.name,
          targetAmount: input.targetAmount.toFixed(2),
          currentAmount: input.trackingType === "manual" ? input.currentAmount.toFixed(2) : "0.00",
          targetDate: input.targetDate,
          trackingType: input.trackingType,
          accountId: input.trackingType === "account" ? input.accountId : null,
        },
        openingContribution,
      );
      return output(goal, userId);
    },
    async update(id: string, userId: string, input: UpdateGoalInput) {
      const current = await findGoal(id, userId);
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
      const adjustment =
        input.currentAmount !== undefined
          ? createGoalBalanceAdjustmentDraft({
              currentAmount: Number(current.currentAmount),
              desiredAmount: input.currentAmount,
              today: today(),
            })
          : null;
      let goal: GoalRecord | null;
      try {
        goal = await repository.updateForUser(
          id,
          userId,
          {
            name: input.name,
            targetAmount: input.targetAmount?.toFixed(2),
            currentAmount:
              frozenAmount !== undefined ? snapshotLinkedGoalBalance(frozenAmount) : undefined,
            targetDate: input.targetDate,
            status: input.status,
          },
          adjustment,
        );
      } catch (error) {
        translateContributionError(error);
      }
      if (!goal) throw notFound("Goal not found", "goal_not_found");
      return output(goal, userId);
    },
    async remove(id: string, userId: string) {
      const goal = await repository.deleteForUser(id, userId);
      if (!goal) throw notFound("Goal not found", "goal_not_found");
      return goal;
    },
    async listContributions(id: string, userId: string): Promise<GoalContributionsOutput> {
      await findGoal(id, userId);
      const contributions = await repository.listContributions(id, userId);
      return {
        items: contributions.map(contributionOutput),
        history: buildGoalContributionHistory({
          contributions: contributions.map((contribution) => ({
            date: contribution.date,
            amount: Number(contribution.amount),
          })),
          today: today(),
        }),
      };
    },
    async addContribution(
      id: string,
      userId: string,
      input: CreateGoalContributionInput,
    ): Promise<CreatedGoalContributionOutput> {
      const goal = await findGoal(id, userId);
      try {
        const draft = createGoalContributionDraft({
          trackingType: goal.trackingType,
          status: goal.status,
          currentAmount: Number(goal.currentAmount),
          movement: input.movement,
          amount: input.amount,
          date: input.date,
          today: today(),
        });
        const contribution = await repository.insertContribution({
          ...draft,
          note: input.note ?? null,
          userId,
          goalId: id,
        });
        return {
          goal: await output(await findGoal(id, userId), userId),
          contribution: contributionOutput(contribution),
        };
      } catch (error) {
        translateContributionError(error);
      }
    },
    async removeContribution(
      id: string,
      contributionId: string,
      userId: string,
    ): Promise<RemovedGoalContributionOutput> {
      const goal = await findGoal(id, userId);
      const contribution = await repository.findContributionForUser(contributionId, id, userId);
      if (!contribution) {
        throw notFound("Goal contribution not found", "goal_contribution_not_found");
      }
      try {
        assertGoalContributionRemovable({
          trackingType: goal.trackingType,
          status: goal.status,
          currentAmount: Number(goal.currentAmount),
          contributionAmount: Number(contribution.amount),
        });
        const removed = await repository.deleteContribution(contributionId, id, userId);
        if (!removed) {
          throw notFound("Goal contribution not found", "goal_contribution_not_found");
        }
      } catch (error) {
        translateContributionError(error);
      }
      return { goal: await output(await findGoal(id, userId), userId) };
    },
  };
}

export type GoalsService = ReturnType<typeof createGoalsService>;

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGoalContributionRemovable,
  buildGoalContributionHistory,
  calculateGoalProgress,
  calculateGoalRequiredMonthlyAmount,
  createGoalBalanceAdjustmentDraft,
  createGoalContributionDraft,
  GoalContributionError,
  resolveGoalPaceStatus,
  snapshotLinkedGoalBalance,
} from "./goals";

test("goal progress clamps a negative account balance and marks overdue targets", () => {
  assert.deepEqual(
    calculateGoalProgress({
      targetAmount: 1000,
      currentAmount: -80,
      createdDate: "2026-01-01",
      targetDate: "2026-06-01",
      today: "2026-06-02",
    }),
    {
      currentAmount: 0,
      remainingAmount: 1000,
      progressPercentage: 0,
      paceStatus: "overdue",
    },
  );
});

test("goal progress distinguishes ahead, behind and achieved", () => {
  const input = {
    targetAmount: 1000,
    createdDate: "2026-01-01",
    targetDate: "2026-01-11",
    today: "2026-01-06",
  };
  assert.equal(calculateGoalProgress({ ...input, currentAmount: 600 }).paceStatus, "ahead");
  assert.equal(calculateGoalProgress({ ...input, currentAmount: 400 }).paceStatus, "behind");
  assert.equal(calculateGoalProgress({ ...input, currentAmount: 1000 }).paceStatus, "achieved");
});

test("paused goals do not show pace and early completion does not claim the amount was reached", () => {
  assert.equal(resolveGoalPaceStatus("paused", "behind"), null);
  assert.equal(resolveGoalPaceStatus("completed", "behind"), null);
  assert.equal(resolveGoalPaceStatus("completed", "achieved"), "achieved");
});

test("linked balance snapshots never store a negative amount", () => {
  assert.equal(snapshotLinkedGoalBalance(-52.13), "0.00");
  assert.equal(snapshotLinkedGoalBalance(52.13), "52.13");
});

const manualGoal = { trackingType: "manual" as const, status: "active" as const };

test("goal contributions sign deposits and withdrawals", () => {
  const base = { ...manualGoal, currentAmount: 300, date: "2026-05-10", today: "2026-05-10" };
  assert.deepEqual(createGoalContributionDraft({ ...base, movement: "deposit", amount: 150.5 }), {
    kind: "deposit",
    amount: "150.50",
    date: "2026-05-10",
  });
  assert.deepEqual(createGoalContributionDraft({ ...base, movement: "withdrawal", amount: 300 }), {
    kind: "withdrawal",
    amount: "-300.00",
    date: "2026-05-10",
  });
});

test("goal contributions reject withdrawals above the balance, future dates and closed goals", () => {
  const base = { ...manualGoal, currentAmount: 100, today: "2026-05-10" };
  const errorCode = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return error instanceof GoalContributionError ? error.code : "unexpected";
    }
    return null;
  };
  assert.equal(
    errorCode(() =>
      createGoalContributionDraft({
        ...base,
        movement: "withdrawal",
        amount: 100.01,
        date: "2026-05-10",
      }),
    ),
    "goal_contribution_exceeds_balance",
  );
  assert.equal(
    errorCode(() =>
      createGoalContributionDraft({ ...base, movement: "deposit", amount: 1, date: "2026-05-11" }),
    ),
    "goal_contribution_future_date",
  );
  for (const goal of [
    { trackingType: "account" as const, status: "active" as const },
    { trackingType: "manual" as const, status: "completed" as const },
    { trackingType: "manual" as const, status: "archived" as const },
  ]) {
    assert.equal(
      errorCode(() =>
        createGoalContributionDraft({
          ...base,
          ...goal,
          movement: "deposit",
          amount: 1,
          date: "2026-05-10",
        }),
      ),
      "goal_contributions_unavailable",
    );
  }
});

test("editing a manual goal amount records only the difference", () => {
  assert.deepEqual(
    createGoalBalanceAdjustmentDraft({
      currentAmount: 250,
      desiredAmount: 200.1,
      today: "2026-05-10",
    }),
    { kind: "adjustment", amount: "-49.90", date: "2026-05-10" },
  );
  assert.equal(
    createGoalBalanceAdjustmentDraft({
      currentAmount: 200,
      desiredAmount: 200,
      today: "2026-05-10",
    }),
    null,
  );
});

test("a contribution can only be removed while the balance stays non-negative", () => {
  assert.doesNotThrow(() =>
    assertGoalContributionRemovable({ ...manualGoal, currentAmount: 80, contributionAmount: -30 }),
  );
  assert.throws(
    () =>
      assertGoalContributionRemovable({
        ...manualGoal,
        currentAmount: 80,
        contributionAmount: 100,
      }),
    GoalContributionError,
  );
});

test("required monthly amount spreads the remaining value over the months left", () => {
  const base = { targetAmount: 1000, currentAmount: 300, today: "2026-11-15" };
  assert.equal(calculateGoalRequiredMonthlyAmount({ ...base, targetDate: "2027-06-30" }), 100);
  assert.equal(calculateGoalRequiredMonthlyAmount({ ...base, targetDate: "2026-11-30" }), 700);
  assert.equal(calculateGoalRequiredMonthlyAmount({ ...base, targetDate: "2027-02-01" }), 233.34);
  assert.equal(calculateGoalRequiredMonthlyAmount({ ...base, targetDate: null }), null);
  assert.equal(calculateGoalRequiredMonthlyAmount({ ...base, targetDate: "2026-11-14" }), null);
  assert.equal(
    calculateGoalRequiredMonthlyAmount({ ...base, currentAmount: 1000, targetDate: "2027-01-01" }),
    null,
  );
});

test("contribution history carries earlier movements into the opening balance", () => {
  const history = buildGoalContributionHistory({
    contributions: [
      { date: "2025-12-20", amount: 500 },
      { date: "2026-02-05", amount: 200 },
      { date: "2026-02-18", amount: -50 },
      { date: "2026-03-01", amount: 100 },
    ],
    today: "2026-03-10",
    months: 3,
  });
  assert.deepEqual(history, [
    { period: "2026-01", deposits: 0, withdrawals: 0, balance: 500 },
    { period: "2026-02", deposits: 200, withdrawals: 50, balance: 650 },
    { period: "2026-03", deposits: 100, withdrawals: 0, balance: 750 },
  ]);
});

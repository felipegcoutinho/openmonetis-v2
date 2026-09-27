import assert from "node:assert/strict";
import test from "node:test";
import { calculateGoalProgress, resolveGoalPaceStatus, snapshotLinkedGoalBalance } from "./goals";

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

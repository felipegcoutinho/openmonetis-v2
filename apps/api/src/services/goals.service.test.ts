import assert from "node:assert/strict";
import test from "node:test";
import {
  createGoalsService,
  type GoalContributionRecord,
  type GoalRecord,
  type GoalsRepository,
} from "./goals.service";

const userId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";

function setup() {
  let goal: GoalRecord | null = null;
  let balance = 400;
  let contributions: GoalContributionRecord[] = [];
  let nextContributionId = 10;
  function record(data: {
    kind: GoalContributionRecord["kind"];
    amount: string;
    date: string;
    note?: string | null;
  }) {
    if (!goal) throw new Error("Goal missing");
    const nextBalance = Number(goal.currentAmount) + Number(data.amount);
    if (nextBalance < 0) throw new Error("check violation");
    const contribution: GoalContributionRecord = {
      id: `00000000-0000-4000-8000-0000000000${nextContributionId++}`,
      goalId: goal.id,
      kind: data.kind,
      amount: data.amount,
      date: data.date,
      note: data.note ?? null,
      createdAt: new Date("2026-01-06T12:00:00Z"),
    };
    contributions = [contribution, ...contributions];
    goal = { ...goal, currentAmount: nextBalance.toFixed(2) };
    return contribution;
  }
  const repository: GoalsRepository = {
    async listByUser(owner) {
      return goal?.userId === owner ? [goal] : [];
    },
    async findByIdForUser(id, owner) {
      return goal?.id === id && goal.userId === owner ? goal : null;
    },
    async findAccountForUser(id, owner) {
      return id === accountId && owner === userId ? { id, isArchived: false } : null;
    },
    async insert(data, openingContribution) {
      goal = {
        ...data,
        id: "00000000-0000-4000-8000-000000000003",
        accountName: data.accountId ? "Poupança" : null,
        accountLogo: data.accountId ? "/logos/test.svg" : null,
        status: "active",
        createdAt: new Date("2026-01-01T12:00:00Z"),
        updatedAt: new Date("2026-01-01T12:00:00Z"),
      };
      if (openingContribution) {
        goal = { ...goal, currentAmount: "0.00" };
        record(openingContribution);
      }
      return goal;
    },
    async updateForUser(id, owner, data, adjustment) {
      if (!goal || goal.id !== id || goal.userId !== owner) return null;
      const defined = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      );
      goal = { ...goal, ...defined };
      if (adjustment) record(adjustment);
      return goal;
    },
    async deleteForUser(id, owner) {
      if (!goal || goal.id !== id || goal.userId !== owner) return null;
      goal = null;
      return { id };
    },
    async listContributions(goalId, owner) {
      return goal?.id === goalId && goal.userId === owner ? contributions : [];
    },
    async findContributionForUser(id, goalId, owner) {
      if (goal?.id !== goalId || goal.userId !== owner) return null;
      return contributions.find((contribution) => contribution.id === id) ?? null;
    },
    async insertContribution(data) {
      return record(data);
    },
    async deleteContribution(id) {
      const contribution = contributions.find((item) => item.id === id);
      if (!contribution || !goal) return false;
      contributions = contributions.filter((item) => item.id !== id);
      goal = {
        ...goal,
        currentAmount: (Number(goal.currentAmount) - Number(contribution.amount)).toFixed(2),
      };
      return true;
    },
  };
  const service = createGoalsService(
    repository,
    {
      async getBalanceSnapshot(id, owner) {
        assert.equal(id, accountId);
        assert.equal(owner, userId);
        return { persisted: balance };
      },
    },
    () => "2026-01-06",
  );
  return {
    service,
    setBalance: (value: number) => {
      balance = value;
    },
  };
}

test("linked goals require an account owned by the user", async () => {
  const { service } = setup();
  await assert.rejects(() =>
    service.create(
      { name: "Viagem", targetAmount: 1000, targetDate: null, trackingType: "account", accountId },
      "00000000-0000-4000-8000-000000000009",
    ),
  );
});

test("linked goals read persisted balance and reject manual amount edits", async () => {
  const { service } = setup();
  const created = await service.create(
    { name: "Viagem", targetAmount: 1000, targetDate: null, trackingType: "account", accountId },
    userId,
  );
  assert.equal(created.currentAmount, 400);
  assert.equal(created.accountLogo, "/logos/test.svg");
  assert.equal(created.remainingAmount, 600);
  await assert.rejects(() => service.update(created.id, userId, { currentAmount: 700 }));
  assert.equal((await service.get(created.id, userId)).currentAmount, 400);
});

test("paused linked goals keep their balance until resumed", async () => {
  const { service, setBalance } = setup();
  const created = await service.create(
    { name: "Viagem", targetAmount: 1000, targetDate: null, trackingType: "account", accountId },
    userId,
  );
  setBalance(600);
  assert.equal((await service.update(created.id, userId, { status: "paused" })).currentAmount, 600);
  setBalance(900);
  assert.equal((await service.get(created.id, userId)).currentAmount, 600);
  assert.equal((await service.update(created.id, userId, { status: "active" })).currentAmount, 900);
});

const manualGoal = {
  name: "Reserva",
  targetAmount: 1000,
  currentAmount: 200,
  targetDate: "2026-05-31",
  trackingType: "manual" as const,
};

test("manual goals keep their saved amount as the opening contribution", async () => {
  const { service } = setup();
  const created = await service.create(manualGoal, userId);
  assert.equal(created.currentAmount, 200);
  assert.equal(created.requiredMonthlyAmount, 200);
  const { items, history } = await service.listContributions(created.id, userId);
  assert.deepEqual(
    items.map(({ kind, amount, date }) => ({ kind, amount, date })),
    [{ kind: "adjustment", amount: 200, date: "2026-01-06" }],
  );
  assert.equal(history.at(-1)?.balance, 200);
});

test("editing the amount of a manual goal records the difference as an adjustment", async () => {
  const { service } = setup();
  const created = await service.create(manualGoal, userId);
  const updated = await service.update(created.id, userId, { currentAmount: 150 });
  assert.equal(updated.currentAmount, 150);
  const { items } = await service.listContributions(created.id, userId);
  assert.deepEqual(
    items.map(({ kind, amount }) => ({ kind, amount })),
    [
      { kind: "adjustment", amount: -50 },
      { kind: "adjustment", amount: 200 },
    ],
  );
});

test("contributions move the balance and can be removed", async () => {
  const { service } = setup();
  const created = await service.create(manualGoal, userId);
  const deposit = await service.addContribution(created.id, userId, {
    movement: "deposit",
    amount: 300,
    date: "2026-01-05",
    note: "Bônus",
  });
  assert.equal(deposit.goal.currentAmount, 500);
  assert.equal(deposit.contribution.note, "Bônus");
  const withdrawal = await service.addContribution(created.id, userId, {
    movement: "withdrawal",
    amount: 100,
    date: "2026-01-06",
  });
  assert.equal(withdrawal.goal.currentAmount, 400);
  assert.equal(withdrawal.contribution.amount, -100);
  const removed = await service.removeContribution(created.id, deposit.contribution.id, userId);
  assert.equal(removed.goal.currentAmount, 100);
});

test("contributions reject overdrafts, future dates and linked goals", async () => {
  const { service } = setup();
  const created = await service.create(manualGoal, userId);
  await assert.rejects(
    () =>
      service.addContribution(created.id, userId, {
        movement: "withdrawal",
        amount: 200.01,
        date: "2026-01-06",
      }),
    { code: "goal_contribution_exceeds_balance" },
  );
  await assert.rejects(
    () =>
      service.addContribution(created.id, userId, {
        movement: "deposit",
        amount: 10,
        date: "2026-01-07",
      }),
    { code: "goal_contribution_future_date" },
  );
  await service.remove(created.id, userId);
  const linked = await service.create(
    { name: "Viagem", targetAmount: 1000, targetDate: null, trackingType: "account", accountId },
    userId,
  );
  await assert.rejects(
    () =>
      service.addContribution(linked.id, userId, {
        movement: "deposit",
        amount: 10,
        date: "2026-01-06",
      }),
    { code: "goal_contributions_unavailable" },
  );
});

test("removing a deposit cannot leave the goal with a negative balance", async () => {
  const { service } = setup();
  const created = await service.create(manualGoal, userId);
  const deposit = await service.addContribution(created.id, userId, {
    movement: "deposit",
    amount: 100,
    date: "2026-01-06",
  });
  await service.addContribution(created.id, userId, {
    movement: "withdrawal",
    amount: 250,
    date: "2026-01-06",
  });
  await assert.rejects(
    () => service.removeContribution(created.id, deposit.contribution.id, userId),
    { code: "goal_contribution_exceeds_balance" },
  );
});

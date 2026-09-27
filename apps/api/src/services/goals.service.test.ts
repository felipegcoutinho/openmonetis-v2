import assert from "node:assert/strict";
import test from "node:test";
import { createGoalsService, type GoalRecord, type GoalsRepository } from "./goals.service";

const userId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";

function setup() {
  let goal: GoalRecord | null = null;
  let balance = 400;
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
    async insert(data) {
      goal = {
        ...data,
        id: "00000000-0000-4000-8000-000000000003",
        accountName: data.accountId ? "Poupança" : null,
        accountLogo: data.accountId ? "/logos/test.svg" : null,
        status: "active",
        createdAt: new Date("2026-01-01T12:00:00Z"),
        updatedAt: new Date("2026-01-01T12:00:00Z"),
      };
      return goal;
    },
    async updateForUser(id, owner, data) {
      if (!goal || goal.id !== id || goal.userId !== owner) return null;
      goal = { ...goal, ...data };
      return goal;
    },
    async deleteForUser(id, owner) {
      if (!goal || goal.id !== id || goal.userId !== owner) return null;
      goal = null;
      return { id };
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

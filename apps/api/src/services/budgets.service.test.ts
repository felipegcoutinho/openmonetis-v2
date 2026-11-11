import assert from "node:assert/strict";
import test from "node:test";
import { type BudgetsRepository, createBudgetsService } from "./budgets.service";

function fixture() {
  const userId = "owner";
  const rows: Awaited<ReturnType<BudgetsRepository["listByUserAndPeriod"]>> = [];
  const spending: Awaited<ReturnType<BudgetsRepository["listSpendingEntries"]>> = [];
  const rules: Awaited<ReturnType<BudgetsRepository["listRecurringRules"]>> = [];
  let writes = 0;
  const repository: BudgetsRepository = {
    async listByUserAndPeriod(user, period) {
      return rows.filter((r) => r.userId === user && r.period === period);
    },
    async findByIdForUser(id, user) {
      return rows.find((r) => r.id === id && r.userId === user) ?? null;
    },
    async findByCategoryAndPeriodForUser(categoryId, period, user) {
      return (
        rows.find((r) => r.userId === user && r.categoryId === categoryId && r.period === period) ??
        null
      );
    },
    async listSpendingEntries(user) {
      assert.equal(user, userId);
      return spending;
    },
    async listRecurringRules(user) {
      assert.equal(user, userId);
      return rules;
    },
    async insertIfAbsent(draft) {
      writes++;
      if (
        rows.some(
          (r) =>
            r.userId === draft.userId &&
            r.categoryId === draft.categoryId &&
            r.period === draft.period,
        )
      )
        return null;
      const row = {
        ...draft,
        id: `budget-${rows.length}`,
        categoryName: draft.categoryId,
        categoryIcon: null,
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-01"),
      };
      rows.push(row);
      return row;
    },
    async updateForUser(id, user, values) {
      writes++;
      const row = rows.find((r) => r.id === id && r.userId === user);
      if (!row) return null;
      Object.assign(row, values);
      return row;
    },
    async deleteForUser(id, user) {
      writes++;
      const index = rows.findIndex((r) => r.id === id && r.userId === user);
      return index < 0 ? null : rows.splice(index, 1)[0];
    },
    async insertCopies(drafts) {
      const created = [];
      for (const draft of drafts) {
        const row = await repository.insertIfAbsent(draft);
        if (row) created.push(row);
      }
      return created;
    },
  };
  const service = createBudgetsService(repository, {
    async findByIdForUser(id, user) {
      assert.equal(user, userId);
      return id === "foreign" ? null : { id, type: id === "salary" ? "income" : "expense" };
    },
  });
  return { userId, rows, spending, rules, repository, service, writes: () => writes };
}

test("budget overview nets refunds, ignores transfers and invoice payments, and includes recurring commitments", async () => {
  const f = fixture();
  await f.service.create({ categoryId: "food", period: "2020-01", amount: 100 }, f.userId);
  f.spending.push(
    { categoryId: "food", type: "expense", origin: "regular", amount: "-80.01" },
    { categoryId: "food", type: "income", origin: "refund", amount: "10.01" },
    { categoryId: "food", type: "expense", origin: "invoicePayment", amount: "-100" },
    { categoryId: "food", type: "transfer", origin: "regular", amount: "-200" },
    { categoryId: "other", type: "expense", origin: "regular", amount: "-15.25" },
    { categoryId: null, type: "expense", origin: "regular", amount: "-4.75" },
  );
  f.rules.push({
    categoryId: "food",
    type: "expense",
    amount: "-20",
    anchorDate: "2020-01-10",
    startDate: "2020-01-10",
    frequency: "monthly",
    paymentMethod: "pix",
    dueDate: null,
    card: null,
    status: "active",
  });
  const result = await f.service.list(f.userId, { period: "2020-01" });
  assert.equal(result.actualSpentAmount, 70);
  assert.equal(result.projectedAmount, 20);
  assert.equal(result.committedAmount, 90);
  assert.equal(result.availableAmount, 10);
  assert.equal(result.usagePercentage, 90);
  assert.equal(result.warningCount, 1);
  assert.equal(result.unbudgetedCommittedAmount, 20);
  assert.equal(result.items[0].status, "warning");
  assert.equal("userId" in result.items[0], false);
});

for (const categoryId of ["foreign", "salary"]) {
  test(`budgets reject ${categoryId} categories before persistence`, async () => {
    const f = fixture();
    await assert.rejects(
      f.service.create({ categoryId, period: "2020-01", amount: 100 }, f.userId),
      { code: "expense_category_not_found" },
    );
    assert.equal(f.writes(), 0);
  });
}

test("budget period conflicts preserve the existing limits and valid changes keep cents", async () => {
  const f = fixture();
  const january = await f.service.create(
    { categoryId: "food", period: "2020-01", amount: 10.01 },
    f.userId,
  );
  await f.service.create({ categoryId: "food", period: "2020-02", amount: 20.02 }, f.userId);
  await assert.rejects(
    f.service.create({ categoryId: "food", period: "2020-01", amount: 99 }, f.userId),
    { code: "budget_already_exists" },
  );
  const before = structuredClone(f.rows);
  const writes = f.writes();
  await assert.rejects(f.service.update(january.id, f.userId, { period: "2020-02", amount: 99 }), {
    code: "budget_already_exists",
  });
  assert.deepEqual(f.rows, before);
  assert.equal(f.writes(), writes);
  const updated = await f.service.update(january.id, f.userId, {
    period: "2020-03",
    amount: 11.11,
  });
  assert.equal(updated.amount, 11.11);
  assert.equal(updated.period, "2020-03");
  assert.equal((await f.service.get(january.id, f.userId)).amount, 11.11);
  assert.deepEqual(await f.service.remove(january.id, f.userId), { id: january.id });
  await assert.rejects(f.service.get(january.id, f.userId), { code: "budget_not_found" });
});

test("copying previous budgets crosses the year and skips existing targets without overwriting", async () => {
  const f = fixture();
  const source = await f.service.create(
    { categoryId: "food", period: "2019-12", amount: 10.01 },
    f.userId,
  );
  const second = await f.service.create(
    { categoryId: "home", period: "2019-12", amount: 20.02 },
    f.userId,
  );
  const existing = await f.service.create(
    { categoryId: "food", period: "2020-01", amount: 99 },
    f.userId,
  );
  const result = await f.service.copyPrevious(
    { period: "2020-01", sourceBudgetIds: [source.id, second.id] },
    f.userId,
  );
  assert.deepEqual(result, { createdCount: 1, skippedCount: 1 });
  assert.equal((await f.service.get(existing.id, f.userId)).amount, 99);
  const copied = (await f.service.list(f.userId, { period: "2020-01" })).items;
  assert.equal(copied.find((r) => r.categoryId === "home")?.amount, 20.02);
});

test("copying a mixed valid and foreign source set is rejected atomically", async () => {
  const f = fixture();
  const source = await f.service.create(
    { categoryId: "food", period: "2019-12", amount: 10 },
    f.userId,
  );
  const before = structuredClone(f.rows);
  const writes = f.writes();
  await assert.rejects(
    f.service.copyPrevious(
      { period: "2020-01", sourceBudgetIds: [source.id, "foreign"] },
      f.userId,
    ),
    { code: "invalid_source_budgets" },
  );
  assert.deepEqual(f.rows, before);
  assert.equal(f.writes(), writes);
});

test("reading and updating a foreign budget are rejected without changing the owner record", async () => {
  const f = fixture();
  const row = await f.service.create(
    { categoryId: "food", period: "2020-01", amount: 10 },
    f.userId,
  );
  const before = structuredClone(f.rows);
  await assert.rejects(f.service.get(row.id, "stranger"), { code: "budget_not_found" });
  await assert.rejects(f.service.update(row.id, "stranger", { amount: 1 }), {
    code: "budget_not_found",
  });
  await assert.rejects(f.service.remove(row.id, "stranger"), { code: "budget_not_found" });
  assert.deepEqual(f.rows, before);
});

import assert from "node:assert/strict";
import test from "node:test";
import { type BudgetsRepository, createBudgetsService } from "./budgets.service";

function fixture() {
  const userId = "owner";
  const rows: Awaited<ReturnType<BudgetsRepository["listByUserAndPeriod"]>> = [];
  const spending: Awaited<ReturnType<BudgetsRepository["listSpendingEntries"]>> = [];
  const rules: Awaited<ReturnType<BudgetsRepository["listRecurringRules"]>> = [];
  const budgetRules: Awaited<ReturnType<BudgetsRepository["listRulesForPeriod"]>> = [];
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
    async listRulesForPeriod(user, period) {
      return budgetRules.filter(
        (rule) =>
          rule.userId === user &&
          rule.startPeriod <= period &&
          (rule.endPeriod === null || rule.endPeriod >= period),
      );
    },
    async findRuleForUser(id, user) {
      return budgetRules.find((rule) => rule.id === id && rule.userId === user) ?? null;
    },
    async withCategoryLock(user, categoryId, work) {
      return work({
        async listRules() {
          return budgetRules.filter(
            (rule) => rule.userId === user && rule.categoryId === categoryId,
          );
        },
        async findMonthlyBudget(period) {
          return (
            rows.find(
              (r) => r.userId === user && r.categoryId === categoryId && r.period === period,
            ) ?? null
          );
        },
        async apply(change) {
          writes++;
          const removeRows = (keep: (row: (typeof rows)[number]) => boolean) => {
            for (let index = rows.length - 1; index >= 0; index--) {
              if (!keep(rows[index] as (typeof rows)[number])) rows.splice(index, 1);
            }
          };
          if (change.deleteMonthlyBudgetId) {
            removeRows((row) => row.id !== change.deleteMonthlyBudgetId);
          }
          if (change.removeAdjustments) {
            const { fromPeriod, toPeriod } = change.removeAdjustments;
            removeRows(
              (row) =>
                row.userId !== user ||
                row.categoryId !== categoryId ||
                row.period < fromPeriod ||
                (toPeriod !== null && row.period > toPeriod),
            );
          }
          if (change.deleteRuleId) {
            const index = budgetRules.findIndex((rule) => rule.id === change.deleteRuleId);
            if (index >= 0) budgetRules.splice(index, 1);
          }
          if (change.updateRule) {
            const { id, ...values } = change.updateRule;
            Object.assign(budgetRules.find((rule) => rule.id === id) ?? {}, values);
          }
          if (change.insertRule) {
            budgetRules.push({
              ...change.insertRule,
              id: `rule-${budgetRules.length}`,
              categoryName: categoryId,
              categoryIcon: null,
              createdAt: new Date("2020-01-01"),
              updatedAt: new Date("2020-01-01"),
            });
          }
          if (change.upsertMonthlyBudget) {
            const draft = change.upsertMonthlyBudget;
            const existing = rows.find(
              (r) => r.userId === user && r.categoryId === categoryId && r.period === draft.period,
            );
            if (existing) existing.amount = draft.amount;
            else await repository.insertIfAbsent(draft);
          }
        },
      });
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
  return {
    userId,
    rows,
    spending,
    rules,
    budgetRules,
    repository,
    service,
    writes: () => writes,
  };
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

test("a recurring budget applies to later months and keeps earlier ones intact", async () => {
  const f = fixture();
  const created = await f.service.create(
    { categoryId: "food", period: "2020-03", amount: 300, repeatMonthly: true },
    f.userId,
  );
  assert.equal(created.budgetId, null);
  assert.equal(created.id, "rule-0:2020-03");
  assert.deepEqual(created.recurrence, {
    ruleId: "rule-0",
    startPeriod: "2020-03",
    endPeriod: null,
  });
  assert.equal((await f.service.list(f.userId, { period: "2020-02" })).items.length, 0);
  assert.equal((await f.service.list(f.userId, { period: "2021-07" })).items[0]?.amount, 300);

  await assert.rejects(
    f.service.create(
      { categoryId: "food", period: "2020-05", amount: 10, repeatMonthly: true },
      f.userId,
    ),
    { code: "budget_rule_overlap" },
  );
});

test("editing a recurring budget adjusts one month or starts a new version", async () => {
  const f = fixture();
  await f.service.create(
    { categoryId: "food", period: "2020-01", amount: 300, repeatMonthly: true },
    f.userId,
  );
  const adjusted = await f.service.updateRule("rule-0", f.userId, {
    scope: "single",
    period: "2020-04",
    amount: 450,
  });
  assert.equal(adjusted.amount, 450);
  assert.ok(adjusted.budgetId);
  assert.equal(adjusted.recurrence?.ruleId, "rule-0");
  assert.equal((await f.service.list(f.userId, { period: "2020-05" })).items[0]?.amount, 300);

  await f.service.updateRule("rule-0", f.userId, {
    scope: "future",
    period: "2020-03",
    amount: 500,
  });
  const amountIn = async (period: string) =>
    (await f.service.list(f.userId, { period })).items[0]?.amount;
  assert.equal(await amountIn("2020-02"), 300);
  assert.equal(await amountIn("2020-03"), 500);
  // The April adjustment was replaced by the new version.
  assert.equal(await amountIn("2020-04"), 500);
  assert.equal(f.rows.length, 0);

  await assert.rejects(
    f.service.updateRule("rule-0", f.userId, { scope: "future", period: "2020-06", amount: 1 }),
    { code: "budget_rule_period_outside" },
  );
});

test("stopping a recurring budget ends it from the month on and a one-off can become recurring", async () => {
  const f = fixture();
  await f.service.create(
    { categoryId: "food", period: "2020-01", amount: 300, repeatMonthly: true },
    f.userId,
  );
  const stopped = await f.service.stopRule("rule-0", f.userId, { period: "2020-06" });
  assert.deepEqual(stopped, { id: "rule-0", endPeriod: "2020-05", deleted: false });
  assert.equal((await f.service.list(f.userId, { period: "2020-05" })).items.length, 1);
  assert.equal((await f.service.list(f.userId, { period: "2020-06" })).items.length, 0);

  const oneOff = await f.service.create(
    { categoryId: "home", period: "2020-02", amount: 80 },
    f.userId,
  );
  const repeated = await f.service.repeat(oneOff.id, f.userId);
  assert.equal(repeated.budgetId, null);
  assert.equal(repeated.recurrence?.startPeriod, "2020-02");
  assert.equal((await f.service.list(f.userId, { period: "2020-09" })).items[0]?.amount, 80);
  await assert.rejects(f.service.stopRule("missing", f.userId, { period: "2020-02" }), {
    code: "budget_rule_not_found",
  });
});

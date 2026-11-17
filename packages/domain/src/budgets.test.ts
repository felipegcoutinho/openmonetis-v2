import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBudgetRuleFits,
  BudgetRuleError,
  calculateBudgetOverview,
  planBudgetRuleAmountChange,
  planBudgetRuleStop,
  resolveBudgetLimits,
} from "./budgets";

test("keeps category excess separate from remaining limits", () => {
  const result = calculateBudgetOverview(
    [
      { categoryId: "food", amount: 100 },
      { categoryId: "transport", amount: 300 },
    ],
    {
      actualByCategory: new Map([
        ["food", 150],
        ["transport", 100],
      ]),
      projectedByCategory: new Map([["food", 50]]),
      uncategorizedActualAmount: 0,
      uncategorizedProjectedAmount: 0,
    },
  );
  assert.equal(result.availableAmount, 200);
  assert.equal(result.exceededAmount, 100);
  assert.equal(result.committedAmount, 300);
  assert.equal(result.usagePercentage, 75);
});

test("breaks down unbudgeted expenses including recurrence-only and uncategorized entries", () => {
  const result = calculateBudgetOverview([{ categoryId: "food", amount: 100 }], {
    actualByCategory: new Map([
      ["food", 20],
      ["health", 40],
      ["refunded", -10],
    ]),
    projectedByCategory: new Map([
      ["health", 10],
      ["rent", 200],
    ]),
    uncategorizedActualAmount: 30,
    uncategorizedProjectedAmount: 5,
  });
  assert.deepEqual(result.unbudgetedItems, [
    { categoryId: "rent", committedAmount: 200 },
    { categoryId: "health", committedAmount: 50 },
    { categoryId: null, committedAmount: 35 },
  ]);
  assert.equal(result.unbudgetedCommittedAmount, 285);
});

test("returns no unbudgeted expenses for an empty month", () => {
  const result = calculateBudgetOverview([], {
    actualByCategory: new Map(),
    projectedByCategory: new Map(),
    uncategorizedActualAmount: 0,
    uncategorizedProjectedAmount: 0,
  });
  assert.deepEqual(result.unbudgetedItems, []);
  assert.equal(result.unbudgetedCommittedAmount, 0);
});

const mercadoRule = {
  id: "rule-1",
  categoryId: "food",
  amount: "1200.00",
  startPeriod: "2026-01",
  endPeriod: null,
};

test("a recurring budget applies from its start month on, and the month's own budget wins", () => {
  const adjustment = { id: "budget-1", categoryId: "food", amount: "900.00" };
  const oneOff = { id: "budget-2", categoryId: "travel", amount: "500.00" };

  assert.deepEqual(resolveBudgetLimits("2025-12", [mercadoRule], []), []);

  const [recurring] = resolveBudgetLimits("2026-11", [mercadoRule], []);
  assert.equal(recurring?.amount, 1200);
  assert.equal(recurring?.budget, null);
  assert.equal(recurring?.rule?.id, "rule-1");

  const limits = resolveBudgetLimits("2026-11", [mercadoRule], [adjustment, oneOff]);
  assert.deepEqual(
    limits.map((limit) => [limit.categoryId, limit.amount, limit.budget?.id, limit.rule?.id]),
    [
      ["food", 900, "budget-1", "rule-1"],
      ["travel", 500, "budget-2", undefined],
    ],
  );
});

test("an ended rule stops applying after its inclusive end month", () => {
  const ended = { ...mercadoRule, endPeriod: "2026-06" };
  assert.equal(resolveBudgetLimits("2026-06", [ended], []).length, 1);
  assert.equal(resolveBudgetLimits("2026-07", [ended], []).length, 0);
});

test("rules of one category never share a month", () => {
  assert.throws(
    () =>
      assertBudgetRuleFits({ categoryId: "food", startPeriod: "2026-11", endPeriod: null }, [
        mercadoRule,
      ]),
    (error) => error instanceof BudgetRuleError && error.code === "budget_rule_overlap",
  );
  const closed = { ...mercadoRule, endPeriod: "2026-10" };
  assertBudgetRuleFits({ categoryId: "food", startPeriod: "2026-11", endPeriod: null }, [closed]);
  assertBudgetRuleFits({ categoryId: "home", startPeriod: "2026-11", endPeriod: null }, [
    mercadoRule,
  ]);
  assertBudgetRuleFits(
    { categoryId: "food", startPeriod: "2026-11", endPeriod: null },
    [mercadoRule],
    ["rule-1"],
  );
});

test("changing the amount from a month on keeps earlier months and drops replaced adjustments", () => {
  const single = planBudgetRuleAmountChange({
    userId: "user",
    rule: mercadoRule,
    period: "2026-11",
    scope: "single",
    amount: 1500,
  });
  assert.deepEqual(single, {
    upsertMonthlyBudget: {
      userId: "user",
      categoryId: "food",
      period: "2026-11",
      amount: "1500.00",
    },
  });

  const future = planBudgetRuleAmountChange({
    userId: "user",
    rule: mercadoRule,
    period: "2026-11",
    scope: "future",
    amount: 1500,
  });
  assert.deepEqual(future.updateRule, { id: "rule-1", endPeriod: "2026-10" });
  assert.deepEqual(future.insertRule, {
    userId: "user",
    categoryId: "food",
    amount: "1500.00",
    startPeriod: "2026-11",
    endPeriod: null,
  });
  assert.deepEqual(future.removeAdjustments, {
    categoryId: "food",
    fromPeriod: "2026-11",
    toPeriod: null,
  });

  const fromStart = planBudgetRuleAmountChange({
    userId: "user",
    rule: mercadoRule,
    period: "2026-01",
    scope: "future",
    amount: 1500,
  });
  assert.deepEqual(fromStart.updateRule, { id: "rule-1", amount: "1500.00" });
  assert.equal(fromStart.insertRule, undefined);

  assert.throws(
    () =>
      planBudgetRuleAmountChange({
        userId: "user",
        rule: mercadoRule,
        period: "2025-12",
        scope: "future",
        amount: 1500,
      }),
    (error) => error instanceof BudgetRuleError && error.code === "budget_rule_period_outside",
  );
});

test("stopping ends the rule before the month, or removes it when it starts there", () => {
  assert.deepEqual(planBudgetRuleStop(mercadoRule, "2026-11"), {
    updateRule: { id: "rule-1", endPeriod: "2026-10" },
    removeAdjustments: { categoryId: "food", fromPeriod: "2026-11", toPeriod: null },
  });
  assert.equal(planBudgetRuleStop(mercadoRule, "2026-01").deleteRuleId, "rule-1");
});

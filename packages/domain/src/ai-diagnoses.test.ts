import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFinancialHealth,
  completeFinancialHealthCharts,
  type FinancialHealthInput,
  hasFinancialHealthData,
  isAiDiagnosisPendingExpired,
  selectAllowedAiDiagnosisActions,
} from "./ai-diagnoses";

function month(period: string, income: number, expenses: number) {
  return { period, income, expenses };
}

const steadyInput: FinancialHealthInput = {
  history: [
    month("2026-01", 10_000, 7_000),
    month("2026-02", 10_000, 7_000),
    month("2026-03", 10_000, 7_000),
    month("2026-04", 10_000, 7_000),
    month("2026-05", 10_000, 7_000),
    month("2026-06", 10_000, 7_000),
  ],
  totalBalance: 42_000,
  expenseCategories: [
    { categoryId: "c1", categoryName: "Moradia", amount: 3_500, previousAmount: 3_500 },
    { categoryId: "c2", categoryName: "Mercado", amount: 2_100, previousAmount: 2_000 },
    { categoryId: "c3", categoryName: "Lazer", amount: 1_400, previousAmount: 1_600 },
  ],
  attention: { critical: 0, warning: 0 },
};

test("a household that saves 30% with six months of reserve scores excellent", () => {
  const health = calculateFinancialHealth(steadyInput);

  assert.deepEqual(health.indicators, {
    savingsRate: 30,
    averageSavingsRate: 30,
    averageMonthlyExpenses: 7_000,
    emergencyFundMonths: 6,
    expenseTrend: 0,
    topCategoryShare: 50,
    criticalAttentionItems: 0,
    warningAttentionItems: 0,
  });
  assert.equal(health.score, 100);
  assert.equal(health.level, "excellent");
  assert.deepEqual(
    health.charts.topExpenseCategories.map((category) => [category.categoryId, category.share]),
    [
      ["c1", 50],
      ["c2", 30],
      ["c3", 20],
    ],
  );
});

test("spending above income, rising expenses and overdue items lower the score", () => {
  const health = calculateFinancialHealth({
    ...steadyInput,
    history: [
      month("2026-01", 5_000, 4_000),
      month("2026-02", 5_000, 4_000),
      month("2026-03", 5_000, 4_000),
      month("2026-04", 5_000, 6_000),
      month("2026-05", 5_000, 6_000),
      month("2026-06", 5_000, 6_000),
    ],
    totalBalance: -1_200,
    attention: { critical: 2, warning: 1 },
  });

  assert.equal(health.indicators.savingsRate, -20);
  assert.equal(health.indicators.averageSavingsRate, 0);
  assert.equal(health.indicators.emergencyFundMonths, 0);
  assert.equal(health.indicators.expenseTrend, 50);
  assert.equal(health.score, 6);
  assert.equal(health.level, "poor");
});

test("months without income leave savings unmeasured instead of dividing by zero", () => {
  const health = calculateFinancialHealth({
    history: [month("2026-05", 0, 0), month("2026-06", 0, 800)],
    totalBalance: 1_600,
    expenseCategories: [],
    attention: { critical: 0, warning: 0 },
  });

  assert.equal(health.indicators.savingsRate, null);
  assert.equal(health.indicators.averageSavingsRate, null);
  assert.equal(health.indicators.emergencyFundMonths, 2);
  assert.equal(health.indicators.expenseTrend, null);
  assert.equal(health.indicators.topCategoryShare, null);
  assert.deepEqual(health.charts.topExpenseCategories, []);
  assert.deepEqual(
    health.charts.savingsRateHistory.map((entry) => entry.savingsRate),
    [null, null],
  );
});

test("a period without any movement has no data to diagnose", () => {
  assert.equal(
    hasFinancialHealthData({ ...steadyInput, history: [month("2026-06", 0, 0)] }),
    false,
  );
  assert.equal(hasFinancialHealthData(steadyInput), true);
});

test("suggested actions stay inside the catalog and the user's categories", () => {
  const actions = selectAllowedAiDiagnosisActions(
    [
      { kind: "createCategoryBudget", label: "Orçar", reason: "", categoryId: "c1" },
      { kind: "createCategoryBudget", label: "Orçar de novo", reason: "", categoryId: "c1" },
      { kind: "reviewCategoryTransactions", label: "Ver", reason: "", categoryId: "unknown" },
      { kind: "reviewCategoryTransactions", label: "Ver", reason: "", categoryId: null },
      { kind: "reviewInvoices", label: "Faturas", reason: "", categoryId: "c2" },
    ],
    new Set(["c1", "c2"]),
  );

  assert.deepEqual(
    actions.map((action) => [action.kind, action.categoryId]),
    [
      ["createCategoryBudget", "c1"],
      ["reviewInvoices", null],
    ],
  );
});

test("a pending diagnosis expires after the timeout", () => {
  const createdAt = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(isAiDiagnosisPendingExpired(createdAt, new Date("2026-06-01T12:04:59.000Z")), false);
  assert.equal(isAiDiagnosisPendingExpired(createdAt, new Date("2026-06-01T12:05:00.000Z")), true);
});

test("the monthly balance chart is income minus expenses, also for older diagnoses", () => {
  const health = calculateFinancialHealth({
    ...steadyInput,
    history: [month("2026-05", 1_000.1, 1_200.3), month("2026-06", 5_000, 3_250.45)],
  });
  assert.deepEqual(health.charts.monthlyBalanceHistory, [
    { period: "2026-05", balance: -200.2 },
    { period: "2026-06", balance: 1_749.55 },
  ]);

  const { monthlyBalanceHistory: _, ...olderCharts } = health.charts;
  assert.deepEqual(
    completeFinancialHealthCharts({ ...health, charts: olderCharts }).charts.monthlyBalanceHistory,
    health.charts.monthlyBalanceHistory,
  );
});

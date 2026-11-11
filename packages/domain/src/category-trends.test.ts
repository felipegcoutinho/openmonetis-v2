import assert from "node:assert/strict";
import test from "node:test";
import { calculateCategoryTrends } from "./category-trends";

const categories = [
  { categoryId: "food", name: "Mercado", icon: null, type: "expense" as const },
  { categoryId: "salary", name: "Salário", icon: null, type: "income" as const },
];

test("summary monthly averages only count months with movement", () => {
  const report = calculateCategoryTrends({
    startPeriod: "2026-01",
    endPeriod: "2026-04",
    categories,
    recurringRules: [],
    actualEntries: [
      {
        categoryId: "food",
        transactionType: "expense",
        type: "expense",
        period: "2026-02",
        amount: 300,
      },
      {
        categoryId: "food",
        transactionType: "expense",
        type: "expense",
        period: "2026-04",
        amount: 100,
      },
      {
        categoryId: "salary",
        transactionType: "income",
        type: "income",
        period: "2026-03",
        amount: 900,
      },
    ],
  });

  assert.equal(report.summary.expenseAmount, 400);
  assert.equal(report.summary.averageMonthlyExpenseAmount, 200);
  assert.equal(report.summary.averageMonthlyIncomeAmount, 900);
  assert.equal(report.summary.averageMonthlyNetAmount, 166.67);
  assert.equal(
    report.categories.find((category) => category.categoryId === "food")?.averageAmount,
    report.summary.averageMonthlyExpenseAmount,
  );
});

test("summary averages fall back to zero when nothing moved", () => {
  const report = calculateCategoryTrends({
    startPeriod: "2026-01",
    endPeriod: "2026-03",
    categories,
    recurringRules: [],
    actualEntries: [],
  });

  assert.equal(report.summary.averageMonthlyExpenseAmount, 0);
  assert.equal(report.summary.averageMonthlyIncomeAmount, 0);
  assert.equal(report.summary.averageMonthlyNetAmount, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardAttentionItems, compareDashboardMetric } from "./dashboard";

const today = "2026-10-29";

test("attention lists overdue and soon-due items first and skips settled or distant ones", () => {
  const items = buildDashboardAttentionItems({
    today,
    invoices: [
      {
        cardId: "card-overdue",
        cardName: "Nubank",
        period: "2026-10",
        dueDate: "2026-10-05",
        remainingAmount: 1188.4,
        status: "overdue",
      },
      {
        cardId: "card-paid",
        cardName: "Itaucard",
        period: "2026-10",
        dueDate: "2026-10-22",
        remainingAmount: 0,
        status: "paid",
      },
      {
        cardId: "card-later",
        cardName: "Inter",
        period: "2026-11",
        dueDate: "2026-11-20",
        remainingAmount: 300,
        status: "open",
      },
    ],
    bills: [
      {
        id: "ipva",
        name: "IPVA",
        dueDate: "2026-11-01",
        amount: 684.32,
        isSettled: false,
        status: "due",
      },
      {
        id: "rent",
        name: "Aluguel",
        dueDate: "2026-10-10",
        amount: 2800,
        isSettled: true,
        status: "paid",
      },
    ],
    budgets: [
      {
        id: "transport",
        categoryId: "category-transport",
        categoryName: "Transporte",
        usagePercentage: 144,
        exceededAmount: 306.07,
        status: "exceeded",
      },
      {
        id: "food",
        categoryId: "category-food",
        categoryName: "Mercado",
        usagePercentage: 82,
        exceededAmount: 0,
        status: "warning",
      },
    ],
    pendingInboxCount: 5,
  });

  assert.deepEqual(
    items.map((item) => [item.id, item.severity]),
    [
      ["invoice:card-overdue:2026-10", "critical"],
      ["bill:ipva", "warning"],
      ["budget:transport", "warning"],
      ["budget:food", "info"],
      ["inbox:pending", "info"],
    ],
  );
  assert.equal(items[0]?.daysUntilDue, -24);
  assert.equal(items[1]?.daysUntilDue, 3);
  assert.equal(items[3]?.budgetStatus, "warning");
  assert.equal(items[3]?.amount, null);
  assert.equal(items[4]?.count, 5);
});

test("an open bill past its due date is critical even before its status is updated", () => {
  const [item] = buildDashboardAttentionItems({
    today,
    invoices: [],
    bills: [
      {
        id: "late",
        name: "Luz",
        dueDate: "2026-10-28",
        amount: 150,
        isSettled: false,
        status: "due",
      },
    ],
    budgets: [],
    pendingInboxCount: 0,
  });
  assert.equal(item?.severity, "critical");
});

test("nothing needs attention when everything is settled and within budget", () => {
  assert.deepEqual(
    buildDashboardAttentionItems({
      today,
      invoices: [],
      bills: [],
      budgets: [],
      pendingInboxCount: 0,
    }),
    [],
  );
});

test("metric comparison never reports a tiny drop as -0%", () => {
  assert.deepEqual(compareDashboardMetric(3684.99, 3689.3), {
    change: { kind: "percent", value: 0 },
    trend: "flat",
  });
  assert.deepEqual(compareDashboardMetric(4135.22, 3912.65), {
    change: { kind: "percent", value: 6 },
    trend: "up",
  });
});

test("metric comparison uses the amount when the base is not positive or the sign flips", () => {
  assert.deepEqual(compareDashboardMetric(0, -223.35), {
    change: { kind: "amount", value: 223.35 },
    trend: "up",
  });
  assert.deepEqual(compareDashboardMetric(-50, 100), {
    change: { kind: "amount", value: -150 },
    trend: "down",
  });
  assert.deepEqual(compareDashboardMetric(0, 0), {
    change: { kind: "amount", value: 0 },
    trend: "flat",
  });
});

test("metric comparison bounds extreme percentages", () => {
  assert.deepEqual(compareDashboardMetric(100000, 1), {
    change: { kind: "percent", value: 999 },
    trend: "up",
  });
});

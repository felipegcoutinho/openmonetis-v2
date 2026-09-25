import assert from "node:assert/strict";
import test from "node:test";
import {
  getPeriodEndDate,
  isTransactionSelectionItemSelectable,
  listRecurrenceDatesInPeriod,
  summarizeTransactionSelection,
  type TransactionSelectionItem,
} from "./transactions";

test("period end uses the final UTC calendar day across month and year boundaries", () => {
  assert.equal(getPeriodEndDate("2026-02").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2024-02").toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2026-12").toISOString(), "2026-12-31T00:00:00.000Z");
});

test("recurrence includes its final effective date", () => {
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      startDate: "2026-09-21",
      endDate: "2026-09-21",
      frequency: "monthly",
      period: "2026-09",
    }),
    ["2026-09-21"],
  );
});

test("versioned recurrence preserves the original calendar anchor", () => {
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      anchorDate: "2026-01-31",
      startDate: "2026-02-28",
      endDate: null,
      frequency: "monthly",
      period: "2026-03",
    }),
    ["2026-03-31"],
  );
});

test("transaction selection summarizes visible signed amounts in cents", () => {
  assert.deepEqual(
    summarizeTransactionSelection([
      { amount: 500, origin: "regular", type: "income" },
      { amount: -100.1, origin: "regular", type: "expense" },
      { amount: -219.9, origin: "regular", type: "expense" },
    ]),
    {
      selectedCount: 3,
      inflow: 500,
      outflow: 320,
      balance: 180,
      neutralCount: 0,
    },
  );
});

test("selection excludes technical and neutral movements", () => {
  const items = [
    { amount: -100, origin: "regular", type: "expense" },
    { amount: -100, origin: "invoicePayment", type: "expense" },
    { amount: 250, origin: "accountBalanceAdjustment", type: "income" },
    { amount: -50, origin: "regular", type: "transfer" },
  ] satisfies TransactionSelectionItem[];

  assert.deepEqual(items.map(isTransactionSelectionItemSelectable), [true, false, false, false]);
  assert.deepEqual(summarizeTransactionSelection(items), {
    selectedCount: 4,
    inflow: 0,
    outflow: 100,
    balance: -100,
    neutralCount: 3,
  });
});

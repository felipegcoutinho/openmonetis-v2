import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveTransactionPostingDate,
  getPeriodEndDate,
  isTransactionSelectionItemSelectable,
  listRecurrenceDatesInPeriod,
  rebalanceTwoAmountShares,
  rebalanceTwoPercentageShares,
  selectRecurringRuleVersionsToUpdate,
  summarizeTransactionSelection,
  type TransactionSelectionItem,
} from "./transactions";

test("posting date follows payment for settled boletos without moving their due period", () => {
  assert.equal(
    deriveTransactionPostingDate({
      paymentMethod: "boleto",
      purchaseDate: "2026-07-20",
      dueDate: "2026-09-10",
      boletoPaymentDate: "2026-08-28",
      isSettled: true,
    }),
    "2026-08-28",
  );
  assert.equal(
    deriveTransactionPostingDate({
      paymentMethod: "boleto",
      purchaseDate: "2026-07-20",
      dueDate: "2026-09-10",
      isSettled: false,
    }),
    null,
  );
});

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

test("recurring edit scope selects past, current and future rule versions correctly", () => {
  const versions = [
    { id: "past", startDate: "2026-01-31" },
    { id: "current", startDate: "2026-02-28" },
    { id: "exception", startDate: "2026-03-31" },
    { id: "later", startDate: "2026-04-30" },
  ];
  const selected = (scope: "single" | "future" | "series") =>
    selectRecurringRuleVersionsToUpdate(versions, "current", "2026-02-28", scope).map(
      (rule) => rule.id,
    );

  assert.deepEqual(selected("single"), []);
  assert.deepEqual(selected("future"), ["exception", "later"]);
  assert.deepEqual(selected("series"), ["past", "current", "exception", "later"]);
  assert.deepEqual(
    selectRecurringRuleVersionsToUpdate(
      versions.map((rule) => ({ ...rule, startDate: new Date(`${rule.startDate}T00:00:00Z`) })),
      "current",
      "2026-02-28",
      "future",
    ).map((rule) => rule.id),
    ["exception", "later"],
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

test("two amount shares conserve cents when editing either participant", () => {
  assert.deepEqual(rebalanceTwoAmountShares(100, 35.25), [35.25, 64.75]);
  assert.deepEqual(rebalanceTwoAmountShares(10.01, 3.33), [3.33, 6.68]);
  assert.deepEqual(rebalanceTwoAmountShares(0.3, 0.1), [0.1, 0.2]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 0), [0, 10]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 10), [10, 0]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 3.335), [3.34, 6.66]);
  for (const [total, edited] of [
    [10, -1],
    [10, 11],
    [NaN, 1],
    [10, Infinity],
  ]) {
    assert.throws(() => rebalanceTwoAmountShares(total, edited), RangeError);
  }
});

test("two percentage shares complement the edited input without changing precision", () => {
  assert.deepEqual(rebalanceTwoPercentageShares(33.33), [33.33, 66.67]);
  assert.deepEqual(rebalanceTwoPercentageShares(0), [0, 100]);
  assert.deepEqual(rebalanceTwoPercentageShares(100), [100, 0]);
  assert.deepEqual(rebalanceTwoPercentageShares(33.333), [33.333, 66.667]);
  for (const percentage of [-1, 101, NaN, Infinity]) {
    assert.throws(() => rebalanceTwoPercentageShares(percentage), RangeError);
  }
});

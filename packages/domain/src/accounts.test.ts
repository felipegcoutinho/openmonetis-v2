import assert from "node:assert/strict";
import test from "node:test";
import { calculateAccountCashFlow, calculateAccountPeriodSummary } from "./accounts";

test("account cash flow reconciles daily movements and monthly balances", () => {
  const flow = calculateAccountCashFlow({
    period: "2026-09",
    historyEndPeriod: "2026-09",
    postings: [
      { period: "2026-08", date: "2026-08-20", amount: 1000 },
      { period: "2026-09", date: "2026-09-03", amount: -100 },
      { period: "2026-09", date: "2026-09-10", amount: 200 },
      { period: "2026-09", date: "2026-09-15", amount: 50, includeInSummary: false },
    ],
  });

  assert.equal(flow.openingBalance, 1000);
  assert.deepEqual(flow.daily[2], {
    date: "2026-09-03",
    income: 0,
    expenses: 100,
    balance: 900,
  });
  assert.deepEqual(flow.daily[14], {
    date: "2026-09-15",
    income: 0,
    expenses: 0,
    balance: 1150,
  });
  assert.deepEqual(flow.history.items.at(-1), {
    period: "2026-09",
    income: 200,
    expenses: 100,
    balance: 1150,
  });
  assert.equal(flow.history.items.length, 12);
  assert.equal(flow.daily.at(-1)?.balance, flow.history.items.at(-1)?.balance);
});

test("account cash flow includes each day in a leap-year February", () => {
  const flow = calculateAccountCashFlow({
    period: "2028-02",
    historyEndPeriod: "2028-02",
    postings: [],
  });

  assert.equal(flow.daily.length, 29);
  assert.equal(flow.endDate, "2028-02-29");
  assert.equal(flow.history.items[0]?.period, "2027-03");
});

test("account cash flow keeps out-of-month dates outside the daily bars", () => {
  const flow = calculateAccountCashFlow({
    period: "2026-09",
    historyEndPeriod: "2026-09",
    postings: [{ period: "2026-09", date: "2026-08-31", amount: -75 }],
  });

  assert.equal(flow.outsideMonthAmount, -75);
  assert.equal(flow.openingBalance, -75);
  assert.equal(flow.daily[0]?.expenses, 0);
  assert.equal(flow.daily.at(-1)?.balance, -75);
  assert.equal(flow.history.items.at(-1)?.expenses, 75);
});

test("account period summary separates the opening balance from the month result", () => {
  const summary = calculateAccountPeriodSummary({
    period: "2026-10",
    postings: [
      { period: "2026-09", amount: 500 },
      { period: "2026-10", amount: 120.5 },
      { period: "2026-10", amount: -80.2 },
      { period: "2026-10", amount: 30, includeInSummary: false },
      { period: "2026-11", amount: -999 },
    ],
  });

  assert.deepEqual(summary, {
    period: "2026-10",
    openingBalance: 500,
    income: 120.5,
    expenses: 80.2,
    netAmount: 40.3,
    balance: 570.3,
  });
});

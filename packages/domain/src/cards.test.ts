import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type CardClosingRule,
  calculateCardCycleSpending,
  calculateCardInvoiceHistory,
  calculateCardInvoiceSummary,
  compareCardCycleSpending,
  getInvoiceDates,
} from "./cards";
import { deriveTransactionPeriod } from "./transactions";

test("closing-day purchases follow the card option across fixed and variable cycles", () => {
  const cases: {
    period: string;
    rule: CardClosingRule;
    dueDay: number;
    nominalClosingDate: string;
    effectiveClosingDate: string;
    nextPeriod: string;
  }[] = [
    {
      period: "2026-10",
      rule: { type: "fixedDay", closingDay: 5 },
      dueDay: 10,
      nominalClosingDate: "2026-10-05",
      effectiveClosingDate: "2026-10-04",
      nextPeriod: "2026-11",
    },
    {
      period: "2026-12",
      rule: { type: "fixedDay", closingDay: 20 },
      dueDay: 10,
      nominalClosingDate: "2026-11-20",
      effectiveClosingDate: "2026-11-19",
      nextPeriod: "2027-01",
    },
    {
      period: "2026-01",
      rule: { type: "fixedDay", closingDay: 1 },
      dueDay: 10,
      nominalClosingDate: "2026-01-01",
      effectiveClosingDate: "2025-12-31",
      nextPeriod: "2026-02",
    },
    {
      period: "2026-03",
      rule: { type: "fixedDay", closingDay: 31 },
      dueDay: 10,
      nominalClosingDate: "2026-02-28",
      effectiveClosingDate: "2026-02-27",
      nextPeriod: "2026-04",
    },
    {
      period: "2024-03",
      rule: { type: "fixedDay", closingDay: 31 },
      dueDay: 10,
      nominalClosingDate: "2024-02-29",
      effectiveClosingDate: "2024-02-28",
      nextPeriod: "2024-04",
    },
    {
      period: "2026-10",
      rule: { type: "daysBeforeDue", days: 7, mode: "calendarDays" },
      dueDay: 10,
      nominalClosingDate: "2026-10-05",
      effectiveClosingDate: "2026-10-04",
      nextPeriod: "2026-11",
    },
    {
      period: "2026-10",
      rule: { type: "daysBeforeDue", days: 5, mode: "weekdays" },
      dueDay: 10,
      nominalClosingDate: "2026-10-05",
      effectiveClosingDate: "2026-10-04",
      nextPeriod: "2026-11",
    },
  ];
  for (const item of cases) {
    for (const enabled of [false, true]) {
      const card = {
        closingDay: null,
        dueDay: item.dueDay,
        closingRule: { ...item.rule, closingDayPurchasesNextInvoice: enabled },
      };
      const dates = getInvoiceDates({ ...card, period: item.period });
      assert.equal(
        dates.closingDate,
        enabled ? item.effectiveClosingDate : item.nominalClosingDate,
      );
      assert.equal(
        dates.dueDate,
        getInvoiceDates({ ...card, closingRule: item.rule, period: item.period }).dueDate,
      );
      assert.equal(
        deriveTransactionPeriod({
          paymentMethod: "credit_card",
          card,
          purchaseDate: item.nominalClosingDate,
        }),
        enabled ? item.nextPeriod : item.period,
      );
      assert.equal(
        deriveTransactionPeriod({
          paymentMethod: "credit_card",
          card,
          purchaseDate: item.effectiveClosingDate,
        }),
        item.period,
      );
    }
  }
});

test("an enabled card closes on the nominal closing day and retains protected invoice dates", () => {
  const input = {
    period: "2026-10",
    limit: 1000,
    closingDay: 5,
    dueDay: 10,
    closingRule: { type: "fixedDay" as const, closingDay: 5, closingDayPurchasesNextInvoice: true },
    today: "2026-10-05",
    paymentStatus: "pending" as const,
    movements: [],
    paidPeriods: [],
  };
  assert.equal(calculateCardInvoiceSummary({ ...input, today: "2026-10-04" }).status, "open");
  assert.equal(calculateCardInvoiceSummary(input).status, "closed");
  for (const protection of [{ datesCustomized: true }, { hasPayments: true }]) {
    const summary = calculateCardInvoiceSummary({
      ...input,
      ...protection,
      persistedClosingDate: "2026-10-05",
      persistedDueDate: "2026-10-12",
    });
    assert.equal(summary.closingDate, "2026-10-05");
    assert.equal(summary.dueDate, "2026-10-12");
  }
});

test("card cycle spending groups net movements by purchase day across month boundaries", () => {
  const result = calculateCardCycleSpending({
    previousClosingDate: "2026-08-30",
    closingDate: "2026-09-03",
    movements: [
      { purchaseDate: "2026-08-30", amount: -90 },
      { purchaseDate: "2026-08-31", amount: -100.1 },
      { purchaseDate: "2026-08-31", amount: 25 },
      { purchaseDate: "2026-09-02", amount: -0.2 },
      { purchaseDate: "2026-09-04", amount: -50 },
    ],
  });

  assert.deepEqual(result, {
    startDate: "2026-08-31",
    endDate: "2026-09-03",
    openingAmount: 140,
    totalAmount: 215.3,
    peakDay: { date: "2026-08-31", amount: 75.1 },
    daily: [
      { date: "2026-08-31", amount: 75.1, cumulativeAmount: 215.1 },
      { date: "2026-09-01", amount: 0, cumulativeAmount: 215.1 },
      { date: "2026-09-02", amount: 0.2, cumulativeAmount: 215.3 },
      { date: "2026-09-03", amount: 0, cumulativeAmount: 215.3 },
    ],
  });
});

test("older installments remain in the opening amount without inventing a purchase day", () => {
  const result = calculateCardCycleSpending({
    previousClosingDate: "2026-02-20",
    closingDate: "2026-03-20",
    movements: [{ purchaseDate: "2026-01-05", amount: -40 }],
  });

  assert.equal(result.openingAmount, 40);
  assert.equal(result.totalAmount, 40);
  assert.equal(result.peakDay, null);
  assert.equal(result.daily.length, 28);
  assert.ok(result.daily.every((day) => day.amount === 0 && day.cumulativeAmount === 40));
});

test("cycle comparison matches the same day of the cycle, including the opening amount", () => {
  const previous = calculateCardCycleSpending({
    previousClosingDate: "2026-07-31",
    closingDate: "2026-08-05",
    movements: [
      { purchaseDate: "2026-06-10", amount: -10 },
      { purchaseDate: "2026-08-01", amount: -100 },
      { purchaseDate: "2026-08-03", amount: -50.5 },
    ],
  });
  const current = calculateCardCycleSpending({
    previousClosingDate: "2026-08-31",
    closingDate: "2026-09-04",
    movements: [
      { purchaseDate: "2026-09-01", amount: -40 },
      { purchaseDate: "2026-09-02", amount: -300.25 },
    ],
  });

  const { daily, comparison } = compareCardCycleSpending({
    current,
    previous,
    today: "2026-09-03",
  });

  assert.deepEqual(
    daily.map((entry) => entry.previousCumulativeAmount),
    [110, 110, 160.5, 160.5],
  );
  assert.deepEqual(comparison, {
    isClosed: false,
    dayOfCycle: 3,
    currentAmount: 340.25,
    previousAmount: 160.5,
    differenceAmount: 179.75,
    trend: "above",
  });
});

test("cycle comparison holds the previous total when the current cycle is longer", () => {
  const previous = calculateCardCycleSpending({
    previousClosingDate: "2026-01-31",
    closingDate: "2026-02-02",
    movements: [{ purchaseDate: "2026-02-01", amount: -80 }],
  });
  const current = calculateCardCycleSpending({
    previousClosingDate: "2026-02-28",
    closingDate: "2026-03-04",
    movements: [{ purchaseDate: "2026-03-01", amount: -30 }],
  });

  const { daily, comparison } = compareCardCycleSpending({
    current,
    previous,
    today: "2026-03-04",
  });

  assert.equal(daily.at(-1)?.previousCumulativeAmount, 80);
  assert.equal(comparison?.trend, "below");
  assert.equal(comparison?.differenceAmount, 50);
});

test("closed cycles compare final totals and cycles without a reference are skipped", () => {
  const previous = calculateCardCycleSpending({
    previousClosingDate: "2026-04-30",
    closingDate: "2026-05-02",
    movements: [{ purchaseDate: "2026-05-01", amount: -20 }],
  });
  const current = calculateCardCycleSpending({
    previousClosingDate: "2026-05-31",
    closingDate: "2026-06-02",
    movements: [{ purchaseDate: "2026-06-02", amount: -20 }],
  });
  const empty = calculateCardCycleSpending({
    previousClosingDate: "2026-04-30",
    closingDate: "2026-05-02",
    movements: [],
  });

  assert.deepEqual(
    compareCardCycleSpending({ current, previous, today: "2026-07-10" }).comparison,
    {
      isClosed: true,
      dayOfCycle: 2,
      currentAmount: 20,
      previousAmount: 20,
      differenceAmount: 0,
      trend: "equal",
    },
  );
  assert.equal(
    compareCardCycleSpending({ current, previous, today: "2026-05-20" }).comparison,
    null,
  );
  assert.equal(
    compareCardCycleSpending({ current, previous: empty, today: "2026-06-01" }).comparison,
    null,
  );
});

test("invoice history groups movements by invoice period and offsets credits", () => {
  assert.deepEqual(
    calculateCardInvoiceHistory(
      [
        { period: "2026-02", amount: -100.1 },
        { period: "2026-02", amount: -0.2 },
        { period: "2026-02", amount: 25 },
        { period: "2026-03", amount: 40 },
      ],
      ["2026-02", "2026-03", "2026-04"],
    ),
    [
      { period: "2026-02", amount: 75.3 },
      { period: "2026-03", amount: 0 },
      { period: "2026-04", amount: 0 },
    ],
  );
});

test("card invoice summary reports paid and remaining amounts of the period", () => {
  const input = {
    period: "2026-10",
    limit: 1000,
    closingDay: 5,
    dueDay: 10,
    today: "2026-10-20",
    paymentStatus: "pending" as const,
    movements: [
      { period: "2026-10", amount: -300 },
      { period: "2026-11", amount: -50 },
    ],
    payments: [
      { period: "2026-10", amount: 120.4 },
      { period: "2026-09", amount: 75 },
    ],
    paidPeriods: [],
  };
  const pending = calculateCardInvoiceSummary(input);
  assert.equal(pending.paidAmount, 120.4);
  assert.equal(pending.remainingAmount, 179.6);

  const paid = calculateCardInvoiceSummary({ ...input, paymentStatus: "paid" });
  assert.equal(paid.paidAmount, 120.4);
  assert.equal(paid.remainingAmount, 0);
});

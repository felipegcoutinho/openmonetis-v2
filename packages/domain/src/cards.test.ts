import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCardCycleSpending, calculateCardInvoiceHistory } from "./cards";

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
  assert.equal(result.daily.length, 28);
  assert.ok(result.daily.every((day) => day.amount === 0 && day.cumulativeAmount === 40));
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

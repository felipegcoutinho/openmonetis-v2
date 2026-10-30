import assert from "node:assert/strict";
import test from "node:test";
import { calculateCardInvoiceSummary } from "./cards";
import {
  type DueDateRule,
  DueDateRuleError,
  defaultDueDateRules,
  findDueDateRuleConflicts,
  resolveDueDate,
  validateDueDateRuleConflicts,
} from "./due-date-rules";

const rule: DueDateRule = {
  id: "rule",
  name: "Boletos",
  target: "payable",
  scope: "all",
  cardIds: [],
  transactionIds: [],
  seriesIds: [],
  adjustment: "next",
  weekends: true,
  holidays: true,
};
const version = { ...defaultDueDateRules("2026-01-01"), revision: 1, rules: [rule] };
const boleto = { type: "expense", paymentMethod: "boleto", dueDate: "2026-10-31" };
test("weekends and national holidays shift across months without modifying original date", () => {
  const resolution = resolveDueDate(boleto, [version]);
  assert.equal(resolution.originalDueDate, "2026-10-31");
  assert.equal(resolution.dueDate, "2026-11-03");
  assert.equal(resolution.dueDateAdjustment?.ruleName, "Boletos");
  assert.deepEqual(resolution.dueDateAdjustment?.reasons, [
    { date: "2026-10-31", weekend: "saturday", nationalHolidayId: null, additionalHoliday: false },
    { date: "2026-11-01", weekend: "sunday", nationalHolidayId: null, additionalHoliday: false },
    {
      date: "2026-11-02",
      weekend: null,
      nationalHolidayId: "allSoulsDay",
      additionalHoliday: false,
    },
  ]);
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2026-11-03" }, [version]).dueDateAdjustment,
    null,
  );
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2027-01-01" }, [
      { ...version, rules: [{ ...rule, adjustment: "previous" }] },
    ]).dueDate,
    "2026-12-31",
  );
});
test("selection limits rules to chosen boletos and recurrence series", () => {
  const selected = {
    ...version,
    rules: [
      {
        ...rule,
        adjustment: "previous" as const,
        scope: "selected" as const,
        transactionIds: ["chosen"],
        seriesIds: ["series"],
      },
    ],
  };
  assert.equal(
    resolveDueDate({ ...boleto, transactionId: "other" }, [selected]).dueDate,
    "2026-11-03",
  );
  assert.equal(
    resolveDueDate({ ...boleto, transactionId: "chosen" }, [selected]).dueDate,
    "2026-10-30",
  );
  assert.equal(resolveDueDate({ ...boleto, seriesId: "series" }, [selected]).dueDate, "2026-10-30");
});
test("income, card purchases, missing due dates and internal movements stay outside payable rules", () => {
  for (const input of [
    { ...boleto, type: "income" },
    { ...boleto, dueDate: null },
    { ...boleto, paymentMethod: null },
    { ...boleto, origin: "refund" },
  ])
    assert.equal(resolveDueDate(input, [version]).dueDate, input.dueDate);
  const invoiceVersion = {
    ...version,
    rules: [{ ...rule, target: "invoice" as const, scope: "selected" as const, cardIds: ["card"] }],
  };
  assert.equal(
    resolveDueDate({ ...boleto, cardId: "card", paymentMethod: "credit_card" }, [invoiceVersion])
      .dueDate,
    "2026-10-31",
  );
  assert.equal(
    resolveDueDate({ target: "invoice", cardId: "card", dueDate: "2026-10-31" }, [invoiceVersion])
      .dueDate,
    "2026-11-03",
  );
});
test("effective customizations preserve earlier behavior and removal restores the default", () => {
  const later = { ...version, revision: 2, effectiveFrom: "2026-11-01", rules: [] };
  assert.equal(resolveDueDate(boleto, [version, later]).dueDate, "2026-11-03");
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2026-11-15" }, [version, later]).dueDate,
    "2026-11-16",
  );
  assert.equal(
    resolveDueDate(boleto, [{ ...version, effectiveFrom: "2026-11-01" }]).dueDate,
    "2026-11-03",
  );
});
test("exceptions and confirmed settlements preserve their dates", () => {
  assert.equal(resolveDueDate({ ...boleto, excluded: true }, [version]).dueDate, "2026-10-31");
  assert.equal(resolveDueDate({ ...boleto, isSettled: true }, [version]).dueDate, "2026-10-31");
  assert.equal(
    resolveDueDate({ ...boleto, isSettled: true, frozenDueDate: "2026-11-03" }, []).dueDate,
    "2026-11-03",
  );
});
test("triggers are independent while resulting dates are always business days", () => {
  const holidayOnly = { ...version, rules: [{ ...rule, weekends: false }] };
  assert.equal(resolveDueDate(boleto, [holidayOnly]).dueDate, "2026-10-31");
  const weekendOnly = { ...version, rules: [{ ...rule, holidays: false }] };
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2026-10-12" }, [weekendOnly]).dueDate,
    "2026-10-12",
  );
  assert.equal(resolveDueDate(boleto, [weekendOnly]).dueDate, "2026-11-03");
  const custom = { ...version, calendar: { ...version.calendar, holidays: ["2026-11-03"] } };
  assert.equal(resolveDueDate(boleto, [custom]).dueDate, "2026-11-04");
});
test("recurring holidays apply every year and are reported as additional holidays", () => {
  const recurring = {
    ...version,
    calendar: { ...version.calendar, recurringHolidays: ["11-03"] },
  };
  const thisYear = resolveDueDate(boleto, [recurring]);
  assert.equal(thisYear.dueDate, "2026-11-04");
  assert.equal(thisYear.dueDateAdjustment?.reasons.at(-1)?.additionalHoliday, true);
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2027-11-03" }, [recurring]).dueDate,
    "2027-11-04",
  );
});
test("conflicting rule ids are listed so each overlap can be pointed out", () => {
  const selected = { ...rule, scope: "selected" as const, transactionIds: ["one"] };
  const conflicts = findDueDateRuleConflicts([
    selected,
    { ...selected, id: "overlap", transactionIds: ["one", "two"] },
    { ...selected, id: "disjoint", transactionIds: ["three"] },
    { ...rule, id: "invoice", target: "invoice" },
  ]);
  assert.deepEqual([...conflicts].sort(), ["overlap", "rule"]);
});
test("overlapping rules are rejected, disjoint selections are allowed", () => {
  assert.throws(
    () => validateDueDateRuleConflicts([rule, { ...rule, id: "other" }]),
    DueDateRuleError,
  );
  assert.doesNotThrow(() =>
    validateDueDateRuleConflicts([
      { ...rule, scope: "selected", transactionIds: ["one"] },
      { ...rule, id: "other", scope: "selected", transactionIds: ["two"] },
    ]),
  );
});
test("invoice adjustment changes overdue status without shifting closing dates or cycle totals", () => {
  const input = {
    period: "2026-10",
    limit: 1000,
    closingDay: 20,
    dueDay: 31,
    today: "2026-11-01",
    paymentStatus: "pending" as const,
    paidPeriods: [],
    movements: [{ period: "2026-10", amount: -100 }],
    cardId: "card",
  };
  const original = calculateCardInvoiceSummary({ ...input, dueDateRuleExcluded: true });
  const adjusted = calculateCardInvoiceSummary({
    ...input,
    dueDateRuleVersions: [{ ...version, rules: [{ ...rule, target: "invoice" }] }],
  });
  assert.equal(adjusted.dueDate, "2026-11-03");
  assert.equal(adjusted.originalDueDate, "2026-10-31");
  assert.equal(adjusted.closingDate, original.closingDate);
  assert.equal(adjusted.amount, original.amount);
  assert.equal(original.status, "overdue");
  assert.equal(adjusted.status, "closed");
  const frozen = calculateCardInvoiceSummary({
    ...input,
    hasPayments: true,
    persistedClosingDate: original.closingDate,
    persistedDueDate: "2026-11-03",
    persistedOriginalDueDate: "2026-10-31",
    dueDateRuleVersions: [],
  });
  assert.equal(frozen.dueDate, "2026-11-03");
  assert.equal(frozen.originalDueDate, "2026-10-31");
});

test("saving an immediate revision supersedes a previously scheduled configuration", () => {
  const scheduled = { ...version, revision: 2, effectiveFrom: "2026-11-01", rules: [] };
  const immediate = { ...version, revision: 3, effectiveFrom: "2026-10-12" };
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2026-11-15" }, [version, scheduled, immediate]).dueDate,
    "2026-11-16",
  );
  assert.equal(
    resolveDueDate({ ...boleto, dueDate: "2026-10-10" }, [version, scheduled, immediate]).dueDate,
    "2026-10-13",
  );
});

test("payables and invoices adjust by default without saved configuration", () => {
  const automatic = resolveDueDate(boleto, []);
  assert.equal(automatic.dueDate, "2026-11-03");
  assert.equal(automatic.dueDateAdjustment?.ruleName, null);
  assert.equal(automatic.dueDateExceptionEditable, true);
  assert.equal(
    resolveDueDate({ target: "invoice", dueDate: "2026-10-31" }, []).dueDate,
    "2026-11-03",
  );
  assert.equal(resolveDueDate({ ...boleto, excluded: true }, []).dueDate, "2026-10-31");
  assert.equal(resolveDueDate({ ...boleto, isSettled: true }, []).dueDateExceptionEditable, false);
  assert.equal(resolveDueDate({ ...boleto, paymentMethod: "pix" }, []).dueDate, "2026-11-03");
});

test("a selected keep-original customization leaves other items on the default policy", () => {
  const customized = {
    ...version,
    rules: [
      {
        ...rule,
        adjustment: "none" as const,
        scope: "selected" as const,
        transactionIds: ["chosen"],
      },
    ],
  };
  assert.equal(
    resolveDueDate({ ...boleto, transactionId: "chosen" }, [customized]).dueDate,
    "2026-10-31",
  );
  assert.equal(
    resolveDueDate({ ...boleto, transactionId: "other" }, [customized]).dueDate,
    "2026-11-03",
  );
  const snapshot = resolveDueDate(boleto, []);
  const frozen = resolveDueDate(
    {
      ...boleto,
      isSettled: true,
      frozenDueDate: snapshot.dueDate,
      frozenAdjustment: snapshot.dueDateAdjustment,
    },
    [customized],
  );
  assert.deepEqual(frozen.dueDateAdjustment, snapshot.dueDateAdjustment);
  assert.equal(frozen.dueDateExceptionEditable, false);
});

test("exceptions reject paid, custom invoice dates, unsupported methods and invalid occurrences", async () => {
  const { assertDueDateExceptionEditable } = await import("./due-date-rules");
  assert.throws(
    () =>
      assertDueDateExceptionEditable({ target: "invoice", isSettled: false, hasPayments: true }),
    { code: "DUE_DATE_EXCEPTION_SETTLED" },
  );
  assert.throws(
    () =>
      assertDueDateExceptionEditable({
        target: "invoice",
        isSettled: false,
        datesCustomized: true,
      }),
    { code: "DUE_DATE_EXCEPTION_CUSTOM_DATES" },
  );
  assert.throws(
    () =>
      assertDueDateExceptionEditable({
        target: "transaction",
        isSettled: false,
        type: "income",
        paymentMethod: "boleto",
        dueDate: "2026-10-31",
      }),
    { code: "DUE_DATE_EXCEPTION_UNSUPPORTED" },
  );
  assert.throws(
    () =>
      assertDueDateExceptionEditable({
        target: "recurring",
        isSettled: false,
        type: "expense",
        paymentMethod: "boleto",
        dueDate: "2026-10-31",
        validOccurrence: false,
      }),
    { code: "INVALID_RECURRING_OCCURRENCE" },
  );
});

test("every payable method uses the shared calendar, customizations, exceptions and payment protection", async () => {
  const { assertDueDateExceptionEditable } = await import("./due-date-rules");
  for (const paymentMethod of [
    "boleto",
    "pix",
    "debit_card",
    "cash",
    "bank_transfer",
    "benefits",
  ]) {
    const payable = { ...boleto, paymentMethod, transactionId: "selected" };
    const adjusted = resolveDueDate(payable, []);
    assert.equal(adjusted.dueDate, "2026-11-03", paymentMethod);
    assert.equal(adjusted.originalDueDate, "2026-10-31");
    assert.equal(adjusted.dueDateAdjustment?.reasons.at(-1)?.nationalHolidayId, "allSoulsDay");
    assert.equal(adjusted.dueDateExceptionEditable, true);
    assert.doesNotThrow(() =>
      assertDueDateExceptionEditable({ ...payable, target: "transaction", isSettled: false }),
    );
    assert.equal(resolveDueDate({ ...payable, excluded: true }, []).dueDate, "2026-10-31");
    assert.equal(
      resolveDueDate(payable, [
        {
          ...version,
          rules: [
            { ...rule, scope: "selected", transactionIds: ["selected"], adjustment: "previous" },
          ],
        },
      ]).dueDate,
      "2026-10-30",
    );
    assert.equal(
      resolveDueDate(payable, [{ ...version, rules: [{ ...rule, adjustment: "none" }] }]).dueDate,
      "2026-10-31",
    );
    const frozen = resolveDueDate(
      {
        ...payable,
        isSettled: true,
        frozenDueDate: adjusted.dueDate,
        frozenAdjustment: adjusted.dueDateAdjustment,
      },
      [],
    );
    assert.equal(frozen.dueDateExceptionEditable, false);
    assert.deepEqual(frozen.dueDateAdjustment, adjusted.dueDateAdjustment);
  }
});

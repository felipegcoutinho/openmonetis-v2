import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonReport,
  comparePersonReportPeriods,
  findPersonReportDeliveryBlocker,
  findPersonReportScheduleRuleError,
  firstPersonReportScheduleDate,
  isPersonReportPeriodOpen,
  isPersonReportScheduleDue,
  listNextPersonReportScheduleDates,
  listPersonReportCommitmentPeriods,
  normalizePersonReportScheduleRule,
  type PersonReportEntry,
  resolvePersonReportSchedulePeriod,
  shouldAttemptScheduledDelivery,
  summarizePersonReportCommitment,
} from "./person-reports";

function entry(overrides: Partial<PersonReportEntry>): PersonReportEntry {
  return {
    id: "entry",
    name: "Mercado",
    purchaseDate: "2026-10-05",
    amount: -100,
    origin: "regular",
    type: "expense",
    paymentMethod: "pix",
    cardId: null,
    cardName: null,
    cardLogo: null,
    categoryId: "food",
    categoryName: "Alimentação",
    categoryIcon: "utensils",
    currentInstallment: null,
    installmentCount: null,
    isRecurring: false,
    ...overrides,
  };
}

const cardEntry = {
  paymentMethod: "credit_card",
  cardId: "6c1f0d4e-8a4b-4c1f-9a2e-111111111111",
  cardName: "Nubank",
  cardLogo: "/logos/nubank.png",
} as const;

test("groups lines by card or payment method, largest total first", () => {
  const report = buildPersonReport({
    entries: [
      entry({ id: "pix", amount: -40 }),
      entry({ id: "late", purchaseDate: "2026-10-20", amount: -30, ...cardEntry }),
      entry({ id: "early", purchaseDate: "2026-10-02", amount: -50.1, ...cardEntry }),
    ],
    settlements: [],
  });

  assert.deepEqual(
    report.groups.map((group) => ({
      key: group.key,
      cardName: group.cardName,
      cardLogo: group.cardLogo,
      paymentMethod: group.paymentMethod,
      totalAmount: group.totalAmount,
      lines: group.lines.map((line) => line.id),
    })),
    [
      {
        key: `card:${cardEntry.cardId}`,
        cardName: "Nubank",
        cardLogo: "/logos/nubank.png",
        paymentMethod: "credit_card",
        totalAmount: 80.1,
        lines: ["early", "late"],
      },
      {
        key: "paymentMethod:pix",
        cardName: null,
        cardLogo: null,
        paymentMethod: "pix",
        totalAmount: 40,
        lines: ["pix"],
      },
    ],
  );
  assert.equal(report.entryCount, 3);
});

test("refunds reduce the group, category and amount the person owes", () => {
  const report = buildPersonReport({
    entries: [
      entry({ id: "purchase", amount: -120, ...cardEntry }),
      entry({ id: "refund", origin: "refund", type: "income", amount: 20, ...cardEntry }),
    ],
    settlements: [{ id: "s1", amount: 30, receivedAt: "2026-10-10", source: "manual" }],
  });

  assert.equal(report.groups[0]?.totalAmount, 100);
  assert.deepEqual(
    report.groups[0]?.lines.map((line) => [line.id, line.kind, line.amount]),
    [
      ["purchase", "expense", 120],
      ["refund", "refund", 20],
    ],
  );
  assert.equal(report.balance.dueAmount, 100);
  assert.equal(report.balance.settledAmount, 30);
  assert.equal(report.balance.receivableAmount, 70);
  assert.equal(report.balance.status, "receivable");
});

test("leaves out invoice payments, balance adjustments, settlements and income", () => {
  const report = buildPersonReport({
    entries: [
      entry({ id: "expense", amount: -10 }),
      entry({ id: "invoice-payment", origin: "invoicePayment", amount: -500 }),
      entry({ id: "adjustment", origin: "accountBalanceAdjustment", amount: -15 }),
      entry({ id: "settlement", origin: "personSettlement", type: "income", amount: 40 }),
      entry({ id: "salary", type: "income", amount: 3000 }),
    ],
    settlements: [],
  });

  assert.deepEqual(
    report.groups.flatMap((group) => group.lines.map((line) => line.id)),
    ["expense"],
  );
  assert.equal(report.balance.assignedAmount, 10);
});

test("orders settlements from the most recent and flags credit when overpaid", () => {
  const report = buildPersonReport({
    entries: [entry({ amount: -50 })],
    settlements: [
      { id: "old", amount: 20, receivedAt: "2026-10-01", source: "manual" },
      { id: "new", amount: 40, receivedAt: "2026-10-15", source: "invoicePayment" },
    ],
  });

  assert.deepEqual(
    report.settlements.map((settlement) => settlement.id),
    ["new", "old"],
  );
  assert.equal(report.balance.creditAmount, 10);
  assert.equal(report.balance.status, "credit");
});

test("reports are delivered only to active people with an email and expenses", () => {
  const eligible = { status: "active", email: "camila@example.com", entryCount: 2 } as const;
  assert.equal(findPersonReportDeliveryBlocker(eligible), null);
  assert.equal(
    findPersonReportDeliveryBlocker({ ...eligible, status: "inactive" }),
    "person_inactive",
  );
  assert.equal(
    findPersonReportDeliveryBlocker({ ...eligible, email: "  " }),
    "person_email_missing",
  );
  assert.equal(
    findPersonReportDeliveryBlocker({ ...eligible, entryCount: 0 }),
    "person_report_empty",
  );
});

test("validates each schedule frequency with its own fields", () => {
  assert.equal(
    findPersonReportScheduleRuleError({ frequency: "weekly", weekday: 1, monthDays: [] }),
    null,
  );
  assert.equal(
    findPersonReportScheduleRuleError({ frequency: "weekly", weekday: 7, monthDays: [] }),
    "schedule_weekday_invalid",
  );
  assert.equal(
    findPersonReportScheduleRuleError({ frequency: "semimonthly", weekday: null, monthDays: [5] }),
    "schedule_month_days_count",
  );
  assert.equal(
    findPersonReportScheduleRuleError({ frequency: "monthly", weekday: null, monthDays: [32] }),
    "schedule_month_days_invalid",
  );
  assert.equal(
    findPersonReportScheduleRuleError({ frequency: "monthDays", weekday: null, monthDays: [] }),
    "schedule_month_days_count",
  );
  assert.deepEqual(
    normalizePersonReportScheduleRule({ frequency: "monthDays", weekday: 3, monthDays: [20, 5] }),
    { frequency: "monthDays", weekday: null, monthDays: [5, 20] },
  );
});

test("weekly schedules send on the weekday and month days fall back to the last day", () => {
  const monday = { frequency: "weekly" as const, weekday: 1, monthDays: [] };
  assert.equal(isPersonReportScheduleDue(monday, "2026-11-09"), true);
  assert.equal(isPersonReportScheduleDue(monday, "2026-11-10"), false);

  const endOfMonth = { frequency: "monthDays" as const, weekday: null, monthDays: [15, 31] };
  assert.equal(isPersonReportScheduleDue(endOfMonth, "2027-02-28"), true);
  assert.equal(isPersonReportScheduleDue(endOfMonth, "2026-11-30"), true);
  assert.deepEqual(listNextPersonReportScheduleDates(endOfMonth, "2027-01-20", 3), [
    "2027-01-31",
    "2027-02-15",
    "2027-02-28",
  ]);
});

test("schedules report the previous or the current month", () => {
  assert.equal(resolvePersonReportSchedulePeriod("previous", "2027-01-01"), "2026-12");
  assert.equal(resolvePersonReportSchedulePeriod("current", "2027-01-01"), "2027-01");
  assert.equal(isPersonReportPeriodOpen("2026-11", "2026-11-07"), true);
  assert.equal(isPersonReportPeriodOpen("2026-10", "2026-11-07"), false);
  assert.equal(firstPersonReportScheduleDate("2026-11-07", 7), "2026-11-07");
  assert.equal(firstPersonReportScheduleDate("2026-11-07", 8), "2026-11-08");
});

test("scheduled deliveries are retried after a delay and a limited number of times", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  assert.equal(shouldAttemptScheduledDelivery(null, now), true);
  assert.equal(
    shouldAttemptScheduledDelivery({ status: "sent", attempts: 1, updatedAt: minutesAgo(60) }, now),
    false,
  );
  assert.equal(
    shouldAttemptScheduledDelivery(
      { status: "failed", attempts: 1, updatedAt: minutesAgo(2) },
      now,
    ),
    false,
  );
  assert.equal(
    shouldAttemptScheduledDelivery(
      { status: "failed", attempts: 1, updatedAt: minutesAgo(11) },
      now,
    ),
    true,
  );
  assert.equal(
    shouldAttemptScheduledDelivery(
      { status: "failed", attempts: 3, updatedAt: minutesAgo(60) },
      now,
    ),
    false,
  );
});

test("compares the month with the previous one", () => {
  assert.deepEqual(
    comparePersonReportPeriods({
      previousPeriod: "2026-10",
      currentAmount: 112,
      previousAmount: 100,
    }),
    { previousPeriod: "2026-10", previousAmount: 100, differenceAmount: 12, changePercentage: 12 },
  );
  assert.equal(
    comparePersonReportPeriods({ previousPeriod: "2026-10", currentAmount: 50, previousAmount: 0 })
      .changePercentage,
    null,
  );
  assert.equal(
    comparePersonReportPeriods({
      previousPeriod: "2026-10",
      currentAmount: 0.1,
      previousAmount: 0.3,
    }).differenceAmount,
    -0.2,
  );
});

test("summarizes the commitments already recorded for the coming months", () => {
  assert.deepEqual(listPersonReportCommitmentPeriods("2026-11"), ["2026-12", "2027-01", "2027-02"]);
  const report = buildPersonReport({
    entries: [
      entry({ id: "installment", amount: -100, currentInstallment: 3, installmentCount: 10 }),
      entry({ id: "recurring", amount: -27, isRecurring: true }),
      entry({ id: "refund", origin: "refund", type: "income", amount: 10 }),
    ],
    settlements: [],
  });
  assert.deepEqual(summarizePersonReportCommitment("2026-12", report), {
    period: "2026-12",
    totalAmount: 117,
    entryCount: 3,
    installmentCount: 1,
    recurringCount: 1,
  });
});

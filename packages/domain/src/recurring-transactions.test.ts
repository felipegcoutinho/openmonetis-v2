import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecurringActionHasNoSettledOccurrences,
  buildRecurringTransactionsReport,
  getEffectiveRecurringEndDate,
  isActiveRecurringOccurrence,
  planRecurringScheduleChange,
  planRecurringTransition,
  RecurringTransitionError,
  type RecurringVersion,
} from "./recurring-transactions";
import { listRecurrenceDatesInPeriod, recurrenceFrequencies } from "./transactions";

const rule: RecurringVersion = {
  id: "first",
  anchorDate: "2026-01-31",
  startDate: "2026-01-31",
  endDate: null,
  recurrenceEndDate: null,
  frequency: "monthly",
  status: "active",
};

test("future schedule changes preserve history and bridge gaps left by isolated edits", () => {
  const versions = [
    { ...rule, endDate: "2026-03-30" },
    { ...rule, id: "single", startDate: "2026-03-31", endDate: "2026-03-31" },
    { ...rule, id: "following", startDate: "2026-04-30" },
  ];
  const plan = planRecurringScheduleChange(versions, "single", "2026-03-31", "2026-03-15");
  assert.equal(plan.boundaryDate, "2026-03-15");
  assert.deepEqual(plan.previousVersionEnds, [{ id: "first", endDate: "2026-03-14" }]);
  assert.deepEqual(plan.futureVersionEnds, [
    { id: "single", endDate: "2026-04-29" },
    { id: "following", endDate: null },
  ]);
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      ...versions[1],
      anchorDate: "2026-03-15",
      startDate: plan.boundaryDate,
      endDate: plan.futureVersionEnds[0].endDate,
      period: "2026-04",
    }),
    ["2026-04-15"],
  );
  assert.throws(() => planRecurringScheduleChange(versions, "single", "2026-03-31", "2026-02-28"), {
    code: "RECURRING_SCHEDULE_OVERLAPS_HISTORY",
  });
  assert.doesNotThrow(() =>
    planRecurringScheduleChange(versions, "single", "2026-03-31", "2026-05-05"),
  );
});

test("rescheduling respects weekly and annual history and cancelled future boundaries", () => {
  assert.throws(
    () =>
      planRecurringScheduleChange(
        [{ ...rule, anchorDate: "2026-01-01", startDate: "2026-01-01", frequency: "weekly" }],
        "first",
        "2026-01-15",
        "2026-01-08",
      ),
    { code: "RECURRING_SCHEDULE_OVERLAPS_HISTORY" },
  );
  assert.throws(
    () =>
      planRecurringScheduleChange(
        [{ ...rule, frequency: "annual" }],
        "first",
        "2027-01-31",
        "2026-01-31",
      ),
    { code: "RECURRING_SCHEDULE_OVERLAPS_HISTORY" },
  );
  assert.throws(
    () =>
      planRecurringScheduleChange(
        [
          { ...rule, endDate: "2026-03-30" },
          { ...rule, id: "cancelled", startDate: "2026-03-31", status: "cancelled" },
        ],
        "first",
        "2026-02-28",
        "2026-04-15",
      ),
    { code: "RECURRING_SCHEDULE_OUTSIDE_RANGE" },
  );
});

test("confirmed settlements are protected and paused or expired occurrences cannot settle", () => {
  assert.equal(isActiveRecurringOccurrence(rule, "2026-02-28"), true);
  assert.equal(isActiveRecurringOccurrence({ ...rule, status: "paused" }, "2026-02-28"), false);
  assert.equal(
    isActiveRecurringOccurrence({ ...rule, recurrenceEndDate: "2026-02-27" }, "2026-02-28"),
    false,
  );
  assert.throws(() => assertRecurringActionHasNoSettledOccurrences("stop", true), {
    code: "RECURRING_OCCURRENCE_SETTLED",
  });
  assert.doesNotThrow(() => assertRecurringActionHasNoSettledOccurrences("resume", true));
});

test("skip preserves the monthly anchor and never resumes beyond a deadline", () => {
  const plan = planRecurringTransition([rule], "skip", "2026-02-28");
  assert.deepEqual(plan, [
    { id: "first", endDate: "2026-02-27", clone: { startDate: "2026-03-01", status: "active" } },
  ]);
  assert.ok(plan[0].clone);
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      ...rule,
      startDate: plan[0].clone.startDate,
      period: "2026-03",
    }),
    ["2026-03-31"],
  );
  assert.deepEqual(
    planRecurringTransition([{ ...rule, recurrenceEndDate: "2026-02-28" }], "skip", "2026-02-28"),
    [{ id: "first", endDate: "2026-02-27" }],
  );
});

test("stop keeps earlier versions and removes all scheduled future versions", () => {
  const versions = [
    { ...rule, endDate: "2026-06-30" },
    { ...rule, id: "future", startDate: "2026-07-01" },
  ];
  assert.deepEqual(planRecurringTransition(versions, "stop", "2026-05-31"), [
    { id: "first", endDate: "2026-05-30" },
    { id: "future", status: "cancelled" },
  ]);
  assert.deepEqual(planRecurringTransition(versions, "stop", "2026-07-31"), [
    { id: "future", endDate: "2026-07-30" },
  ]);
});

test("pause and resume preserve the paused interval and later version boundaries", () => {
  const versions = [
    { ...rule, endDate: "2026-06-30" },
    { ...rule, id: "future", startDate: "2026-07-01" },
  ];
  assert.deepEqual(planRecurringTransition(versions, "pause", "2026-05-31"), [
    { id: "first", endDate: "2026-05-30", clone: { startDate: "2026-05-31", status: "paused" } },
    { id: "future", status: "paused" },
  ]);
  assert.deepEqual(
    planRecurringTransition(
      versions.map((item) => ({ ...item, status: "paused" })),
      "resume",
      "2026-06-30",
    ),
    [
      { id: "first", endDate: "2026-06-29", clone: { startDate: "2026-06-30", status: "active" } },
      { id: "future", status: "active" },
    ],
  );
});

test("invalid dates, cancelled rules and incompatible state transitions are rejected", () => {
  for (const [versions, action, date] of [
    [[rule], "skip", "2026-02-27"],
    [[rule], "resume", "2026-02-28"],
    [[{ ...rule, status: "cancelled" }], "resume", "2026-02-28"],
    [[{ ...rule, recurrenceEndDate: "2026-02-28" }], "stop", "2026-03-31"],
    [[rule], "pause", "2025-12-31"],
  ] as const)
    assert.throws(
      () => planRecurringTransition([...versions], action, date),
      RecurringTransitionError,
    );
});

test("deadlines are inclusive for every frequency and cannot extend version boundaries", () => {
  assert.equal(getEffectiveRecurringEndDate("2026-06-30", "2026-12-31"), "2026-06-30");
  assert.equal(getEffectiveRecurringEndDate(null, "2026-12-31"), "2026-12-31");
  for (const frequency of recurrenceFrequencies) {
    const input = {
      anchorDate: "2026-01-15",
      startDate: "2026-01-15",
      endDate: "2026-01-15",
      frequency,
    };
    assert.deepEqual(listRecurrenceDatesInPeriod({ ...input, period: "2026-01" }), ["2026-01-15"]);
    assert.deepEqual(listRecurrenceDatesInPeriod({ ...input, period: "2027-01" }), []);
  }
});

test("management groups versions once and monthly projections retain historical amounts", () => {
  const versions = [
    { ...rule, id: "old", seriesId: "salary", amount: 1000, endDate: "2026-02-28" },
    {
      ...rule,
      id: "new",
      seriesId: "salary",
      amount: 1200,
      startDate: "2026-03-01",
      recurrenceEndDate: "2026-04-30",
    },
  ];
  const report = buildRecurringTransactionsReport({
    versions,
    period: "2026-02",
    today: "2026-02-28",
  });
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].ruleId, "old");
  assert.equal(report.items[0].actionDate, "2026-02-28");
  assert.equal(report.projections.length, 12);
  assert.deepEqual(report.projections.slice(0, 4), [
    { period: "2026-02", total: 1000 },
    { period: "2026-03", total: 1200 },
    { period: "2026-04", total: 1200 },
    { period: "2026-05", total: 0 },
  ]);
  assert.equal(report.projections.at(-1)?.period, "2027-01");
  assert.equal(report.summary.projectionTotal, 3400);
  assert.equal(report.summary.monthlyAverage, 283.33);
  const next = buildRecurringTransactionsReport({
    versions,
    period: "2026-03",
    today: "2026-03-01",
  });
  assert.equal(next.items[0].ruleId, "new");
  assert.equal(next.items[0].actionDate, "2026-03-31");
});

test("weekly forecasts respect inclusive deadlines without multiplying monthly rule values", () => {
  const report = buildRecurringTransactionsReport({
    period: "2026-03",
    today: "2026-03-01",
    versions: [
      {
        ...rule,
        seriesId: "weekly",
        amount: "-10.01",
        anchorDate: "2026-03-02",
        startDate: "2026-03-02",
        recurrenceEndDate: "2026-03-23",
        frequency: "weekly",
      },
    ],
  });
  assert.equal(report.summary.projectedTotal, 40.04);
  assert.equal(report.projections[1].total, 0);
  assert.equal(report.items[0].actionDate, "2026-03-02");
});

test("paused, stopped, expired and future-start series remain distinguishable", () => {
  const report = buildRecurringTransactionsReport({
    period: "2026-03",
    today: "2026-03-31",
    versions: [
      { ...rule, seriesId: "paused", amount: 100, status: "paused" },
      { ...rule, seriesId: "stopped", amount: 200, endDate: "2026-02-27" },
      {
        ...rule,
        id: "cancelled",
        seriesId: "stopped",
        amount: 300,
        startDate: "2026-03-01",
        status: "cancelled",
      },
      { ...rule, seriesId: "expired", amount: 400, recurrenceEndDate: "2026-02-28" },
      {
        ...rule,
        id: "future",
        seriesId: "future",
        amount: 500,
        anchorDate: "2030-01-31",
        startDate: "2030-01-31",
      },
    ],
  });
  assert.deepEqual(report.summary, {
    activeCount: 1,
    pausedCount: 1,
    endedCount: 2,
    projectedTotal: 0,
    projectionTotal: 0,
    monthlyAverage: 0,
  });
  assert.equal(report.items.find((item) => item.seriesId === "paused")?.actionDate, "2026-03-31");
  assert.equal(report.items.find((item) => item.seriesId === "paused")?.nextOccurrenceDate, null);
  assert.equal(report.items.find((item) => item.seriesId === "stopped")?.actionDate, null);
  assert.equal(
    report.items.find((item) => item.seriesId === "future")?.nextOccurrenceDate,
    "2030-01-31",
  );
});

test("skipped final occurrence ends management entry without restoring the skipped value", () => {
  const report = buildRecurringTransactionsReport({
    period: "2026-01",
    today: "2026-01-01",
    versions: [
      {
        ...rule,
        seriesId: "skipped",
        amount: 100,
        endDate: "2026-01-30",
        recurrenceEndDate: "2026-01-31",
      },
    ],
  });
  assert.equal(report.items[0].status, "ended");
  assert.equal(report.summary.projectedTotal, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { defaultBusinessCalendar } from "./business-calendars";
import {
  buildCalendarMonth,
  type CalendarEntryInput,
  resolveCalendarEntryStatus,
} from "./calendar";

const entry = (overrides: Partial<CalendarEntryInput>): CalendarEntryInput => ({
  id: "entry",
  kind: "bill",
  date: "2026-11-10",
  title: "Conta",
  amount: 100,
  openAmount: 100,
  isDone: false,
  ...overrides,
});

test("calendar entries are overdue, pending, done or informational", () => {
  const today = "2026-11-15";
  assert.equal(resolveCalendarEntryStatus(entry({ date: "2026-11-14" }), today), "overdue");
  assert.equal(resolveCalendarEntryStatus(entry({ date: "2026-11-15" }), today), "pending");
  assert.equal(
    resolveCalendarEntryStatus(entry({ date: "2026-11-01", isDone: true }), today),
    "done",
  );
  assert.equal(
    resolveCalendarEntryStatus(entry({ kind: "invoiceClosing", date: "2026-11-01" }), today),
    "info",
  );
});

test("calendar month lists every day with holidays and business days", () => {
  const month = buildCalendarMonth({
    period: "2026-11",
    today: "2026-11-15",
    calendar: { ...defaultBusinessCalendar, holidays: ["2026-11-03"] },
    entries: [],
  });
  assert.equal(month.days.length, 30);
  const day = (date: string) => month.days.find((item) => item.date === date);
  assert.deepEqual(day("2026-11-02")?.holiday, { kind: "national", id: "allSoulsDay" });
  assert.equal(day("2026-11-02")?.isBusinessDay, false);
  assert.deepEqual(day("2026-11-03")?.holiday, { kind: "custom" });
  assert.equal(day("2026-11-04")?.isBusinessDay, true);
  assert.equal(day("2026-11-07")?.isBusinessDay, false);
  assert.equal(day("2026-11-15")?.isToday, true);
});

test("calendar month groups entries by day and sums open and paid amounts", () => {
  const month = buildCalendarMonth({
    period: "2026-11",
    today: "2026-11-15",
    calendar: defaultBusinessCalendar,
    entries: [
      entry({ id: "rent", title: "Aluguel", date: "2026-11-10", amount: 1500, openAmount: 1500 }),
      entry({
        id: "card",
        kind: "invoiceDue",
        title: "Cartão",
        date: "2026-11-10",
        amount: 900,
        openAmount: 400,
      }),
      entry({
        id: "power",
        title: "Energia",
        date: "2026-11-20",
        amount: 210.5,
        openAmount: 0,
        isDone: true,
      }),
      entry({ id: "closing", kind: "invoiceClosing", date: "2026-11-03", amount: 900 }),
      entry({ id: "task", kind: "task", title: "Declarar IR", date: "2026-11-20", amount: null }),
      entry({ id: "other-month", date: "2026-12-01" }),
    ],
  });
  assert.deepEqual(month.summary, {
    openAmount: 1900,
    paidAmount: 710.5,
    overdueCount: 2,
    entryCount: 5,
  });
  const tenth = month.days.find((day) => day.date === "2026-11-10");
  assert.equal(tenth?.openAmount, 1900);
  assert.deepEqual(
    tenth?.entries.map((item) => [item.kind, item.status]),
    [
      ["invoiceDue", "overdue"],
      ["bill", "overdue"],
    ],
  );
  const twentieth = month.days.find((day) => day.date === "2026-11-20");
  assert.deepEqual(
    twentieth?.entries.map((item) => [item.id, item.status]),
    [
      ["task", "pending"],
      ["power", "done"],
    ],
  );
});

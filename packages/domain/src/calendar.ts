import {
  type BusinessCalendar,
  isBusinessDay,
  isRecurringHoliday,
  listNationalHolidays,
  type nationalHolidayIds,
} from "./business-calendars";
import { fromCents, toCents } from "./money";
import { getPeriodEndDate } from "./transactions";

export const calendarEntryKinds = ["invoiceDue", "bill", "invoiceClosing", "task"] as const;
export type CalendarEntryKind = (typeof calendarEntryKinds)[number];

export const calendarEntryStatuses = ["done", "pending", "overdue", "info"] as const;
export type CalendarEntryStatus = (typeof calendarEntryStatuses)[number];

export type CalendarHoliday =
  | { kind: "national"; id: (typeof nationalHolidayIds)[number] }
  | { kind: "custom" };

/** A dated item from one of the sources the calendar gathers. */
export type CalendarEntryInput = {
  id: string;
  kind: CalendarEntryKind;
  date: string;
  title: string;
  /** Total amount; `null` for entries without a value, such as tasks. */
  amount: number | null;
  /** Part still to be paid. Ignored for entries without an amount. */
  openAmount: number;
  /** Paid bills and invoices and completed tasks. */
  isDone: boolean;
};

/** Distributes over unions, so each kind keeps its own fields. */
export type CalendarEntry<T extends CalendarEntryInput = CalendarEntryInput> = T extends unknown
  ? Omit<T, "isDone"> & { status: CalendarEntryStatus }
  : never;

export type CalendarDay<T extends CalendarEntryInput = CalendarEntryInput> = {
  date: string;
  isToday: boolean;
  isBusinessDay: boolean;
  holiday: CalendarHoliday | null;
  openAmount: number;
  entries: CalendarEntry<T>[];
};

export type CalendarMonth<T extends CalendarEntryInput = CalendarEntryInput> = {
  period: string;
  summary: {
    openAmount: number;
    paidAmount: number;
    overdueCount: number;
    entryCount: number;
  };
  days: CalendarDay<T>[];
};

const kindOrder = new Map(calendarEntryKinds.map((kind, index) => [kind, index]));
const statusOrder = new Map<CalendarEntryStatus, number>([
  ["overdue", 0],
  ["pending", 1],
  ["info", 2],
  ["done", 3],
]);

export function isPayableCalendarEntry(kind: CalendarEntryKind) {
  return kind === "bill" || kind === "invoiceDue";
}

export function resolveCalendarEntryStatus(
  entry: Pick<CalendarEntryInput, "kind" | "date" | "isDone">,
  today: string,
): CalendarEntryStatus {
  if (entry.kind === "invoiceClosing") return "info";
  if (entry.isDone) return "done";
  return entry.date < today ? "overdue" : "pending";
}

export function findCalendarHoliday(
  date: string,
  calendar: BusinessCalendar,
): CalendarHoliday | null {
  if (calendar.includeNationalHolidays) {
    const national = listNationalHolidays(Number(date.slice(0, 4))).find(
      (holiday) => holiday.date === date,
    );
    if (national) return { kind: "national", id: national.id };
  }
  if (calendar.holidays.includes(date) || isRecurringHoliday(date, calendar)) {
    return { kind: "custom" };
  }
  return null;
}

function compareEntries(
  left: Pick<CalendarEntry, "status" | "kind" | "title">,
  right: Pick<CalendarEntry, "status" | "kind" | "title">,
) {
  return (
    (statusOrder.get(left.status) ?? 0) - (statusOrder.get(right.status) ?? 0) ||
    (kindOrder.get(left.kind) ?? 0) - (kindOrder.get(right.kind) ?? 0) ||
    left.title.localeCompare(right.title, "pt-BR")
  );
}

/** Groups the entries of a month by day, in the user's business calendar. */
export function buildCalendarMonth<T extends CalendarEntryInput>(input: {
  period: string;
  today: string;
  calendar: BusinessCalendar;
  entries: readonly T[];
}): CalendarMonth<T> {
  const lastDay = getPeriodEndDate(input.period).getUTCDate();
  const byDate = new Map<string, CalendarEntry<T>[]>();
  let openCents = 0;
  let paidCents = 0;
  let overdueCount = 0;
  let entryCount = 0;

  for (const entry of input.entries) {
    if (!entry.date.startsWith(`${input.period}-`)) continue;
    const { isDone: _isDone, ...rest } = entry;
    const status = resolveCalendarEntryStatus(entry, input.today);
    const item = { ...rest, status } as CalendarEntry<T>;
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), item]);
    entryCount += 1;
    if (status === "overdue") overdueCount += 1;
    if (isPayableCalendarEntry(entry.kind) && entry.amount !== null) {
      const open = Math.max(0, toCents(entry.openAmount));
      openCents += open;
      paidCents += Math.max(0, toCents(entry.amount) - open);
    }
  }

  const days = Array.from({ length: lastDay }, (_, index) => {
    const date = `${input.period}-${String(index + 1).padStart(2, "0")}`;
    const entries = (byDate.get(date) ?? []).sort(compareEntries);
    const dayOpenCents = entries.reduce(
      (total, entry) =>
        isPayableCalendarEntry(entry.kind) && entry.amount !== null
          ? total + Math.max(0, toCents(entry.openAmount))
          : total,
      0,
    );
    return {
      date,
      isToday: date === input.today,
      isBusinessDay: isBusinessDay(date, input.calendar),
      holiday: findCalendarHoliday(date, input.calendar),
      openAmount: fromCents(dayOpenCents),
      entries,
    };
  });

  return {
    period: input.period,
    summary: {
      openAmount: fromCents(openCents),
      paidAmount: fromCents(paidCents),
      overdueCount,
      entryCount,
    },
    days,
  };
}

import { getNextRecurringOccurrenceDate, resolveRecurringDueDate } from "./recurring-expenses";
import { getOccurrenceAmount, type SettlementAwareRule } from "./settlements";
import {
  addMonthsToPeriod,
  listRecurrenceDatesInPeriod,
  type RecurrenceFrequency,
} from "./transactions";

export const recurringActions = ["pause", "resume", "skip", "stop"] as const;
export type RecurringAction = (typeof recurringActions)[number];
type RuleStatus = "active" | "paused" | "cancelled";
export type RecurringVersion = import("./recurring-expenses").DatedRecurringRule & {
  id: string;
  startDate: string;
  endDate: string | null;
  recurrenceEndDate?: string | null;
  dueDate?: string | null;
  anchorDate: string;
  frequency: RecurrenceFrequency;
  status: RuleStatus;
};
export class RecurringTransitionError extends Error {
  constructor(public readonly code = "INVALID_RECURRING_TRANSITION") {
    super(code);
  }
}

export function getEffectiveRecurringEndDate(
  endDate: string | null,
  recurrenceEndDate?: string | null,
) {
  if (!endDate) return recurrenceEndDate ?? null;
  return recurrenceEndDate && recurrenceEndDate < endDate ? recurrenceEndDate : endDate;
}

export function planRecurringTransition(
  versions: RecurringVersion[],
  action: RecurringAction,
  date: string,
) {
  const applicable = versions.filter((rule) => {
    const end = getEffectiveRecurringEndDate(rule.endDate, rule.recurrenceEndDate);
    return rule.status !== "cancelled" && (!end || end >= date);
  });
  const selected = applicable.find((rule) => rule.startDate <= date);
  if (
    !selected ||
    (action === "resume"
      ? selected.status !== "paused"
      : action !== "stop" && selected.status !== "active")
  ) {
    throw new RecurringTransitionError();
  }
  if (
    action === "skip" &&
    !listRecurrenceDatesInPeriod({
      ...selected,
      endDate: getEffectiveRecurringEndDate(selected.endDate, selected.recurrenceEndDate),
      period: date.slice(0, 7),
    }).includes(date)
  )
    throw new RecurringTransitionError();

  const previousDate = shiftDate(date, -1);
  return applicable.flatMap((rule) => {
    if (action === "skip" && rule.id !== selected.id) return [];
    if (action === "resume" && rule.status !== "paused") return [];
    if (action === "pause" && rule.status !== "active") return [];
    const status: RuleStatus =
      action === "stop" ? "cancelled" : action === "pause" ? "paused" : "active";
    const changes: {
      id: string;
      endDate?: string;
      status?: RuleStatus;
      clone?: { startDate: string; status: RuleStatus };
    } = { id: rule.id };
    if (rule.startDate >= date && action !== "skip") {
      changes.status = status;
    } else {
      changes.endDate = previousDate;
      const cloneStart = action === "skip" ? shiftDate(date, 1) : date;
      const end = getEffectiveRecurringEndDate(rule.endDate, rule.recurrenceEndDate);
      if (action !== "stop" && (!end || cloneStart <= end))
        changes.clone = { startDate: cloneStart, status };
    }
    return [changes];
  });
}

export function isActiveRecurringOccurrence(rule: RecurringVersion, date: string) {
  return (
    rule.status === "active" &&
    listRecurrenceDatesInPeriod({
      ...rule,
      endDate: getEffectiveRecurringEndDate(rule.endDate, rule.recurrenceEndDate),
      period: date.slice(0, 7),
    }).includes(date)
  );
}

/** Move the future schedule without removing or overlapping an earlier occurrence. */
export function planRecurringScheduleChange(
  versions: RecurringVersion[],
  selectedRuleId: string,
  occurrenceDate: string,
  anchorDate: string,
) {
  const selected = versions.find((version) => version.id === selectedRuleId);
  if (!selected) throw new RecurringTransitionError();
  for (const version of versions) {
    if (version.startDate >= occurrenceDate) continue;
    const end = getEffectiveRecurringEndDate(version.endDate, version.recurrenceEndDate);
    const lastDate = end && end < occurrenceDate ? end : shiftDate(occurrenceDate, -1);
    // All supported frequencies have at least one occurrence within thirteen months.
    for (let offset = 0; offset <= 12; offset++) {
      const dates = listRecurrenceDatesInPeriod({
        ...version,
        endDate: end,
        period: addMonthsToPeriod(lastDate.slice(0, 7), -offset),
      }).filter((date) => date < occurrenceDate);
      if (dates.length) {
        if (dates.some((date) => date >= anchorDate))
          throw new RecurringTransitionError("RECURRING_SCHEDULE_OVERLAPS_HISTORY");
        break;
      }
    }
  }
  const boundaryDate = anchorDate < occurrenceDate ? anchorDate : occurrenceDate;
  const previousDate = shiftDate(boundaryDate, -1);
  const futureVersions = [
    selected,
    ...versions
      .filter((version) => version.id !== selectedRuleId && version.startDate >= occurrenceDate)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  ];
  const futureVersionEnds = futureVersions.map((version, index) => ({
    id: version.id,
    // Single-occurrence edits may leave a gap up to the next old reference date.
    // The new schedule covers that gap, while preserving planned status boundaries.
    endDate: futureVersions[index + 1]
      ? shiftDate(futureVersions[index + 1].startDate, -1)
      : version.endDate,
  }));
  const target = [...futureVersions]
    .reverse()
    .find(
      (version) => (version.id === selectedRuleId ? boundaryDate : version.startDate) <= anchorDate,
    );
  const targetEnd = futureVersionEnds.find((version) => version.id === target?.id)?.endDate;
  if (!target || target.status === "cancelled" || (targetEnd && anchorDate > targetEnd))
    throw new RecurringTransitionError("RECURRING_SCHEDULE_OUTSIDE_RANGE");
  return {
    boundaryDate,
    previousDate,
    futureVersionEnds,
    previousVersionEnds: versions
      .filter(
        (version) =>
          version.id !== selectedRuleId &&
          version.startDate < occurrenceDate &&
          (!version.endDate || version.endDate >= boundaryDate),
      )
      .map((version) => ({ id: version.id, endDate: previousDate })),
  };
}

export function assertRecurringActionHasNoSettledOccurrences(
  action: RecurringAction,
  hasSettledOccurrences: boolean,
) {
  if (action !== "resume" && hasSettledOccurrences)
    throw new RecurringTransitionError("RECURRING_OCCURRENCE_SETTLED");
}

function shiftDate(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export type RecurringReportVersion = RecurringVersion &
  SettlementAwareRule & {
    seriesId: string;
    amount: string | number;
  };

/** The report projects every series from the current month over this many months. */
export const recurringProjectionMonthCount = 12;

/** Projections include historical versions; management lists each series only once. */
export function buildRecurringTransactionsReport(input: {
  versions: RecurringReportVersion[];
  /** First projected month, normally the current month. */
  period: string;
  today: string;
}) {
  const periods = Array.from({ length: recurringProjectionMonthCount }, (_, index) =>
    addMonthsToPeriod(input.period, index),
  );
  const totals = new Map(periods.map((period) => [period, 0]));
  const series = new Map<string, RecurringReportVersion[]>();
  for (const version of input.versions) {
    const group = series.get(version.seriesId) ?? [];
    group.push(version);
    series.set(version.seriesId, group);
    if (version.status !== "active") continue;
    // One month of margin on each side catches due dates shifted across a month boundary.
    for (let offset = -1; offset <= recurringProjectionMonthCount; offset++) {
      for (const date of listRecurrenceDatesInPeriod({
        ...version,
        endDate: getEffectiveRecurringEndDate(version.endDate, version.recurrenceEndDate),
        period: addMonthsToPeriod(input.period, offset),
      })) {
        const dueDate = resolveRecurringDueDate(date, version.dueDate ?? null) ?? date;
        const period = dueDate.slice(0, 7);
        if (totals.has(period))
          totals.set(
            period,
            (totals.get(period) ?? 0) +
              Math.round(Math.abs(getOccurrenceAmount(version, date, version.amount)) * 100),
          );
      }
    }
  }

  const items = [...series.values()].map((versions) => {
    const upcoming = versions
      .flatMap((version) => {
        if (version.status === "cancelled") return [];
        const date = getNextRecurringOccurrenceDate({
          ...version,
          currentDate: shiftDate(
            version.startDate > input.today ? version.startDate : input.today,
            -1,
          ),
          endDate: getEffectiveRecurringEndDate(version.endDate, version.recurrenceEndDate),
        });
        return date ? [{ version, date }] : [];
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0];
    const latest = [...versions].sort(
      (a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id),
    )[0];
    const version = next?.version ?? latest;
    const status: "active" | "paused" | "ended" = next
      ? version.status === "paused"
        ? "paused"
        : "active"
      : "ended";
    return {
      ruleId: version.id,
      seriesId: version.seriesId,
      status,
      actionDate: next?.date ?? null,
      nextOccurrenceDate:
        status === "active" && next
          ? (resolveRecurringDueDate(next.date, version.dueDate ?? null) ?? next.date)
          : null,
    };
  });
  const projectedCents = [...totals.values()].reduce((sum, cents) => sum + cents, 0);
  return {
    items,
    summary: {
      activeCount: items.filter((item) => item.status === "active").length,
      pausedCount: items.filter((item) => item.status === "paused").length,
      endedCount: items.filter((item) => item.status === "ended").length,
      projectedTotal: (totals.get(input.period) ?? 0) / 100,
      projectionTotal: projectedCents / 100,
      monthlyAverage: Math.round(projectedCents / recurringProjectionMonthCount) / 100,
    },
    projections: periods.map((period) => ({ period, total: (totals.get(period) ?? 0) / 100 })),
  };
}

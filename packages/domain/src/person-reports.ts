import { fromCents, toCents } from "./money";
import { calculatePersonBalance, type PersonBalance } from "./person-settlements";
import {
  addMonthsToPeriod,
  calculateExpenseImpact,
  type PaymentMethod,
  type TransactionOrigin,
  type TransactionType,
} from "./transactions";

export type PersonReportEntry = {
  id: string;
  name: string;
  purchaseDate: string;
  /** Signed amount attributed to the person, as stored on the transaction or its split. */
  amount: number;
  origin: TransactionOrigin;
  type: TransactionType;
  paymentMethod: PaymentMethod | null;
  cardId: string | null;
  cardName: string | null;
  cardLogo: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  currentInstallment: number | null;
  installmentCount: number | null;
  isRecurring: boolean;
};

export type PersonReportSettlement = {
  id: string;
  amount: number;
  receivedAt: string;
  source: "manual" | "invoicePayment";
};

export type PersonReportLine = {
  id: string;
  name: string;
  purchaseDate: string;
  /** Positive magnitude; `kind` tells whether it adds to or reduces what the person owes. */
  amount: number;
  kind: "expense" | "refund";
  categoryName: string | null;
  categoryIcon: string | null;
  currentInstallment: number | null;
  installmentCount: number | null;
  isRecurring: boolean;
};

export type PersonReportGroup = {
  key: string;
  cardId: string | null;
  cardName: string | null;
  cardLogo: string | null;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
  lines: PersonReportLine[];
};

export type PersonReport = {
  balance: PersonBalance;
  groups: PersonReportGroup[];
  settlements: PersonReportSettlement[];
  entryCount: number;
};

/**
 * Same scope as the person's settlement balance: regular expenses, refunds and invoice
 * adjustments. Invoice payments, balance adjustments and settlements are not spending.
 */
export function isPersonReportEntry(entry: Pick<PersonReportEntry, "origin" | "type">) {
  return (
    (entry.origin === "regular" && entry.type === "expense") ||
    entry.origin === "refund" ||
    entry.origin === "invoiceAdjustment"
  );
}

type ReportLineWithSource = { line: PersonReportLine; entry: PersonReportEntry; cents: number };

export function buildPersonReport(input: {
  entries: PersonReportEntry[];
  settlements: PersonReportSettlement[];
}): PersonReport {
  const lines = input.entries.flatMap((entry): ReportLineWithSource[] => {
    if (!isPersonReportEntry(entry)) return [];
    const cents = toCents(calculateExpenseImpact(entry));
    if (cents === 0) return [];
    return [
      {
        cents,
        entry,
        line: {
          id: entry.id,
          name: entry.name,
          purchaseDate: entry.purchaseDate,
          amount: fromCents(Math.abs(cents)),
          kind: cents > 0 ? "expense" : "refund",
          categoryName: entry.categoryName,
          categoryIcon: entry.categoryIcon,
          currentInstallment: entry.currentInstallment,
          installmentCount: entry.installmentCount,
          isRecurring: entry.isRecurring,
        },
      },
    ];
  });

  return {
    balance: calculatePersonBalance([
      ...lines.map(({ line }) => ({ kind: line.kind, amount: line.amount })),
      ...input.settlements.map((settlement) => ({
        kind: "settlement" as const,
        amount: settlement.amount,
      })),
    ]),
    groups: groupLines(lines),
    settlements: [...input.settlements].sort(
      (left, right) =>
        right.receivedAt.localeCompare(left.receivedAt) || left.id.localeCompare(right.id),
    ),
    entryCount: lines.length,
  };
}

function groupLines(lines: ReportLineWithSource[]): PersonReportGroup[] {
  const groups = new Map<
    string,
    { group: Omit<PersonReportGroup, "totalAmount">; cents: number }
  >();

  for (const { line, entry, cents } of lines) {
    const key = entry.cardId
      ? `card:${entry.cardId}`
      : `paymentMethod:${entry.paymentMethod ?? "none"}`;
    const current = groups.get(key) ?? {
      cents: 0,
      group: {
        key,
        cardId: entry.cardId,
        cardName: entry.cardId ? entry.cardName : null,
        cardLogo: entry.cardId ? entry.cardLogo : null,
        paymentMethod: entry.cardId ? "credit_card" : entry.paymentMethod,
        lines: [],
      },
    };
    current.cents += cents;
    current.group.lines.push(line);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map(({ group, cents }) => ({
      ...group,
      totalAmount: fromCents(cents),
      lines: group.lines.sort(
        (left, right) =>
          left.purchaseDate.localeCompare(right.purchaseDate) ||
          left.name.localeCompare(right.name, "pt-BR"),
      ),
    }))
    .sort(
      (left, right) =>
        right.totalAmount - left.totalAmount ||
        groupSortLabel(left).localeCompare(groupSortLabel(right), "pt-BR"),
    );
}

function groupSortLabel(group: Pick<PersonReportGroup, "cardName" | "paymentMethod">) {
  return group.cardName ?? group.paymentMethod ?? "";
}

/** How many months ahead the report lists what the person already has to pay. */
export const personReportCommitmentMonths = 3;

export type PersonReportComparison = {
  previousPeriod: string;
  previousAmount: number;
  differenceAmount: number;
  /** Percentage change from the previous month; null when the previous month had nothing. */
  changePercentage: number | null;
};

export type PersonReportCommitment = {
  period: string;
  totalAmount: number;
  entryCount: number;
  installmentCount: number;
  recurringCount: number;
};

export function getPreviousPersonReportPeriod(period: string) {
  return addMonthsToPeriod(period, -1);
}

export function listPersonReportCommitmentPeriods(period: string) {
  return Array.from({ length: personReportCommitmentMonths }, (_, index) =>
    addMonthsToPeriod(period, index + 1),
  );
}

/** Compares what the person owes for the month, before settlements, with the previous month. */
export function comparePersonReportPeriods(input: {
  previousPeriod: string;
  currentAmount: number;
  previousAmount: number;
}): PersonReportComparison {
  const currentCents = toCents(input.currentAmount);
  const previousCents = toCents(input.previousAmount);
  const differenceCents = currentCents - previousCents;
  return {
    previousPeriod: input.previousPeriod,
    previousAmount: fromCents(previousCents),
    differenceAmount: fromCents(differenceCents),
    changePercentage:
      previousCents > 0 ? Math.round((differenceCents / previousCents) * 1_000) / 10 : null,
  };
}

/**
 * What is already recorded for a coming month: installments, recurring expenses and any other
 * expense attributed to the person. Settlements are left out, since they have not happened yet.
 */
export function summarizePersonReportCommitment(
  period: string,
  report: Pick<PersonReport, "balance" | "groups" | "entryCount">,
): PersonReportCommitment {
  const lines = report.groups.flatMap((group) => group.lines);
  return {
    period,
    totalAmount: report.balance.dueAmount,
    entryCount: report.entryCount,
    installmentCount: lines.filter((line) => line.currentInstallment && line.installmentCount)
      .length,
    recurringCount: lines.filter((line) => line.isRecurring).length,
  };
}

export const personReportDeliveryTriggers = ["manual", "scheduled"] as const;
export const personReportDeliveryStatuses = ["pending", "sent", "failed"] as const;

export type PersonReportDeliveryTrigger = (typeof personReportDeliveryTriggers)[number];
export type PersonReportDeliveryStatus = (typeof personReportDeliveryStatuses)[number];

export type PersonReportDeliveryBlocker =
  | "person_inactive"
  | "person_email_missing"
  | "person_report_empty";

/** A report is only delivered to an active person with an email and something to report. */
export function findPersonReportDeliveryBlocker(input: {
  status: "active" | "inactive";
  email: string | null;
  entryCount: number;
}): PersonReportDeliveryBlocker | null {
  if (input.status !== "active") return "person_inactive";
  if (!input.email?.trim()) return "person_email_missing";
  if (input.entryCount === 0) return "person_report_empty";
  return null;
}

export const personReportScheduleFrequencies = [
  "weekly",
  "semimonthly",
  "monthly",
  "monthDays",
] as const;
/** Which month a scheduled email reports: the closed previous month or the open current one. */
export const personReportSchedulePeriods = ["previous", "current"] as const;

export type PersonReportScheduleFrequency = (typeof personReportScheduleFrequencies)[number];
export type PersonReportSchedulePeriod = (typeof personReportSchedulePeriods)[number];

/** Scheduled reports leave from this hour on, Brasília time. */
export const personReportScheduleHour = 8;
export const maximumPersonReportScheduleMonthDays = 10;
export const maximumScheduledDeliveryAttempts = 3;
export const scheduledDeliveryRetryDelayMs = 10 * 60_000;

export type PersonReportScheduleRule = {
  frequency: PersonReportScheduleFrequency;
  /** 0 (Sunday) to 6 (Saturday); only for weekly schedules. */
  weekday: number | null;
  /** Days 1 to 31; a day past the end of a shorter month falls on its last day. */
  monthDays: number[];
};

export type PersonReportScheduleRuleError =
  | "schedule_weekday_invalid"
  | "schedule_month_days_invalid"
  | "schedule_month_days_count";

const requiredMonthDayCount: Partial<Record<PersonReportScheduleFrequency, number>> = {
  semimonthly: 2,
  monthly: 1,
};

export function findPersonReportScheduleRuleError(
  rule: PersonReportScheduleRule,
): PersonReportScheduleRuleError | null {
  if (rule.frequency === "weekly") {
    return Number.isInteger(rule.weekday) &&
      (rule.weekday as number) >= 0 &&
      (rule.weekday as number) <= 6
      ? null
      : "schedule_weekday_invalid";
  }
  const days = rule.monthDays;
  if (
    days.some((day) => !Number.isInteger(day) || day < 1 || day > 31) ||
    new Set(days).size !== days.length
  ) {
    return "schedule_month_days_invalid";
  }
  const required = requiredMonthDayCount[rule.frequency];
  const validCount = required
    ? days.length === required
    : days.length >= 1 && days.length <= maximumPersonReportScheduleMonthDays;
  return validCount ? null : "schedule_month_days_count";
}

/** Keeps only the fields the frequency uses, with month days in ascending order. */
export function normalizePersonReportScheduleRule(
  rule: PersonReportScheduleRule,
): PersonReportScheduleRule {
  if (rule.frequency === "weekly") {
    return { frequency: rule.frequency, weekday: rule.weekday, monthDays: [] };
  }
  return {
    frequency: rule.frequency,
    weekday: null,
    monthDays: [...new Set(rule.monthDays)].sort((left, right) => left - right),
  };
}

/** The month a new schedule reports by default: monthly closes the previous month. */
export function defaultPersonReportSchedulePeriod(
  frequency: PersonReportScheduleFrequency,
): PersonReportSchedulePeriod {
  return frequency === "monthly" ? "previous" : "current";
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function addDays(date: string, days: number) {
  const instant = new Date(`${date}T12:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/** Whether the schedule sends on this calendar date (YYYY-MM-DD). */
export function isPersonReportScheduleDue(rule: PersonReportScheduleRule, date: string) {
  if (rule.frequency === "weekly") {
    return new Date(`${date}T12:00:00.000Z`).getUTCDay() === rule.weekday;
  }
  const { year, month, day } = parseDateOnly(date);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return rule.monthDays.some((monthDay) => Math.min(monthDay, lastDay) === day);
}

/** The next sending dates from `fromDate` on, inclusive. */
export function listNextPersonReportScheduleDates(
  rule: PersonReportScheduleRule,
  fromDate: string,
  count: number,
) {
  const dates: string[] = [];
  for (let offset = 0; dates.length < count && offset < 400; offset += 1) {
    const date = addDays(fromDate, offset);
    if (isPersonReportScheduleDue(rule, date)) dates.push(date);
  }
  return dates;
}

/** First date a schedule saved now can still send on: today only before the sending hour. */
export function firstPersonReportScheduleDate(today: string, currentHour: number) {
  return currentHour < personReportScheduleHour ? today : addDays(today, 1);
}

export function resolvePersonReportSchedulePeriod(
  reportPeriod: PersonReportSchedulePeriod,
  date: string,
) {
  const period = date.slice(0, 7);
  return reportPeriod === "current" ? period : getPreviousPersonReportPeriod(period);
}

/** A report of the current month, or a later one, can still change: it is partial. */
export function isPersonReportPeriodOpen(period: string, today: string) {
  return period >= today.slice(0, 7);
}

/**
 * A scheduled delivery goes out once per person and date. A failed or interrupted one is retried
 * after a delay, a limited number of times.
 */
export function shouldAttemptScheduledDelivery(
  existing: { status: PersonReportDeliveryStatus; attempts: number; updatedAt: Date } | null,
  now: Date,
) {
  if (!existing) return true;
  if (existing.status === "sent") return false;
  if (existing.attempts >= maximumScheduledDeliveryAttempts) return false;
  return now.getTime() - existing.updatedAt.getTime() >= scheduledDeliveryRetryDelayMs;
}

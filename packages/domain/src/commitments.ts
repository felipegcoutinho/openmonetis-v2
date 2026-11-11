import type { CategoryTrendRecurringRule } from "./category-trends";
import {
  calculateInstallmentGroups,
  type InstallmentReportRow,
  moneyToCents,
} from "./installments";
import { getRecurringDueDate } from "./recurring-expenses";
import { getOccurrenceAmount } from "./settlements";
import {
  addMonthsToPeriod,
  calculateExpenseImpact,
  deriveTransactionPeriod,
  isExpenseReduction,
  listRecurrenceDatesInPeriod,
  type TransactionOrigin,
} from "./transactions";

export const commitmentStatuses = ["healthy", "attention", "critical"] as const;
export type CommitmentStatus = (typeof commitmentStatuses)[number];

/** Share of the expected income below which the month is considered healthy. */
export const commitmentAttentionThreshold = 60;
/** Share of the expected income from which the month is considered critical. */
export const commitmentCriticalThreshold = 85;
/** Default horizon, in months, counted from the current period. */
export const defaultCommitmentMonths = 6;
export const maxCommitmentMonths = 24;
/** A drop of at least this share of the previous month's structural commitments marks a relief. */
export const commitmentReliefThreshold = 10;

/**
 * Single (non-installment, non-recurring) entry already launched for a future or current period.
 * Refunds and invoice adjustments reduce the month's commitments instead of adding income.
 */
export type CommitmentSingleEntry = {
  period: string;
  type: "income" | "expense";
  origin: TransactionOrigin;
  amount: string | number;
};

export type CommitmentMonth = {
  period: string;
  installmentsAmount: number;
  recurringAmount: number;
  billsAmount: number;
  creditsAmount: number;
  committedAmount: number;
  incomeAmount: number;
  freeAmount: number;
  commitmentPercentage: number | null;
  status: CommitmentStatus;
};

export type EndingInstallmentSeries = {
  seriesId: string;
  name: string;
  endPeriod: string;
  monthlyAmount: number;
  remainingAmount: number;
};

export type CommitmentRelief = {
  period: string;
  previousPeriod: string;
  releasedAmount: number;
  percentage: number;
};

/** Number of calendar months in an inclusive `YYYY-MM` range (negative when reversed). */
export function countCommitmentMonths(startPeriod: string, endPeriod: string) {
  const index = (period: string) => {
    const [year, month] = period.split("-").map(Number);
    return year * 12 + month - 1;
  };
  return index(endPeriod) - index(startPeriod) + 1;
}

export type CommitmentsReport = {
  period: string;
  months: CommitmentMonth[];
  endingSeries: EndingInstallmentSeries[];
  relief: CommitmentRelief | null;
};

export function resolveCommitmentStatus(percentage: number | null, committedCents: number) {
  if (percentage === null) return committedCents > 0 ? "critical" : "healthy";
  if (percentage >= commitmentCriticalThreshold) return "critical";
  if (percentage >= commitmentAttentionThreshold) return "attention";
  return "healthy";
}

export function calculateCommitments(input: {
  period: string;
  months: number;
  installmentRows: readonly InstallmentReportRow[];
  recurringRules: readonly CategoryTrendRecurringRule[];
  singleEntries: readonly CommitmentSingleEntry[];
}): CommitmentsReport {
  const periods = Array.from({ length: input.months }, (_, index) =>
    addMonthsToPeriod(input.period, index),
  );
  const totals = new Map(
    periods.map((period) => [
      period,
      { installments: 0, recurring: 0, bills: 0, credits: 0, income: 0 } as Record<string, number>,
    ]),
  );
  const add = (period: string, key: string, cents: number) => {
    const total = totals.get(period);
    if (total) total[key] += cents;
  };

  const installmentGroups = calculateInstallmentGroups([...input.installmentRows], input.period);
  for (const group of installmentGroups) {
    for (const installment of group.installments) {
      add(installment.period, "installments", moneyToCents(installment.amount));
    }
  }

  const lastPeriod = periods[periods.length - 1] as string;
  for (const rule of input.recurringRules) {
    if (rule.status !== "active") continue;
    for (const occurrencePeriod of listPeriodRange(
      addMonthsToPeriod(input.period, -2),
      addMonthsToPeriod(lastPeriod, 1),
    )) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        dueDate: rule.dueDate,
        recurrenceEndDate: rule.configuredEndDate,
        anchorDate: rule.anchorDate,
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: occurrencePeriod,
      })) {
        if (rule.occurrenceAccountExclusions?.[purchaseDate] ?? rule.excludeFromBalance) continue;
        const transactionPeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: getRecurringDueDate(rule.dueDate, purchaseDate),
          card: rule.card,
        });
        const cents = Math.abs(moneyToCents(getOccurrenceAmount(rule, purchaseDate, rule.amount)));
        add(transactionPeriod, rule.type === "income" ? "income" : "recurring", cents);
      }
    }
  }

  for (const entry of input.singleEntries) {
    if (entry.type === "income" && !isExpenseReduction(entry)) {
      add(entry.period, "income", moneyToCents(entry.amount));
      continue;
    }
    const impactCents = Math.round(calculateExpenseImpact(entry) * 100);
    if (impactCents < 0) add(entry.period, "credits", -impactCents);
    else add(entry.period, "bills", impactCents);
  }

  const months = periods.map((period): CommitmentMonth => {
    const total = totals.get(period) as Record<string, number>;
    const committedCents = Math.max(
      0,
      total.installments + total.recurring + total.bills - total.credits,
    );
    const percentage =
      total.income > 0 ? Math.round((committedCents / total.income) * 1000) / 10 : null;
    return {
      period,
      installmentsAmount: total.installments / 100,
      recurringAmount: total.recurring / 100,
      billsAmount: total.bills / 100,
      creditsAmount: total.credits / 100,
      committedAmount: committedCents / 100,
      incomeAmount: total.income / 100,
      freeAmount: (total.income - committedCents) / 100,
      commitmentPercentage: percentage,
      status: resolveCommitmentStatus(percentage, committedCents),
    };
  });

  const endingSeries = installmentGroups
    .flatMap((group) => {
      if (group.pendingInstallmentCount === 0 || !group.endPeriod) return [];
      if (group.endPeriod < input.period || group.endPeriod > lastPeriod) return [];
      const last = group.installments.find((item) => item.period === group.endPeriod);
      return [
        {
          seriesId: group.seriesId,
          name: group.name,
          endPeriod: group.endPeriod,
          monthlyAmount: last?.amount ?? 0,
          remainingAmount: group.pendingAmount,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.endPeriod.localeCompare(right.endPeriod) ||
        right.monthlyAmount - left.monthlyAmount ||
        left.seriesId.localeCompare(right.seriesId),
    );

  return { period: input.period, months, endingSeries, relief: findRelief(months) };
}

/**
 * First month in which the structural commitments (installments and recurring series) drop
 * relevantly versus the previous month. Single bills are left out: future months rarely have
 * them launched yet, so including them would report reliefs that are only missing data.
 */
function findRelief(months: readonly CommitmentMonth[]): CommitmentRelief | null {
  const structuralCents = (month: CommitmentMonth) =>
    Math.round(month.installmentsAmount * 100) + Math.round(month.recurringAmount * 100);
  for (let index = 1; index < months.length; index += 1) {
    const previous = months[index - 1] as CommitmentMonth;
    const current = months[index] as CommitmentMonth;
    const previousCents = structuralCents(previous);
    const releasedCents = previousCents - structuralCents(current);
    if (previousCents <= 0 || releasedCents <= 0) continue;
    const percentage = Math.round((releasedCents / previousCents) * 1000) / 10;
    if (percentage >= commitmentReliefThreshold) {
      return {
        period: current.period,
        previousPeriod: previous.period,
        releasedAmount: releasedCents / 100,
        percentage,
      };
    }
  }
  return null;
}

function listPeriodRange(startPeriod: string, endPeriod: string) {
  const periods: string[] = [];
  for (let period = startPeriod; period <= endPeriod; period = addMonthsToPeriod(period, 1)) {
    periods.push(period);
  }
  return periods;
}

import type { CardClosingRule } from "./cards";
import {
  addMonthsToPeriod,
  deriveTransactionPeriod,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
  type TransactionOrigin,
  type TransactionType,
} from "./transactions";

export const budgetStatuses = ["onTrack", "warning", "reached", "exceeded"] as const;
export type BudgetStatus = (typeof budgetStatuses)[number];

export const budgetWarningThreshold = 80;

export type BudgetCreateDraft = {
  userId: string;
  categoryId: string;
  period: string;
  amount: string;
};

export type BudgetSpendingEntry = {
  categoryId: string | null;
  origin: TransactionOrigin;
  type: TransactionType;
  amount: string | number;
};

export type BudgetRecurringRule = {
  categoryId: string | null;
  type: TransactionType;
  amount: string | number;
  startDate: string;
  endDate?: string | null;
  frequency: RecurrenceFrequency;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  card: { closingDay: number | null; closingRule?: CardClosingRule; dueDay: number } | null;
  status: "active" | "paused" | "cancelled";
};

export type BudgetProgress = {
  actualSpentAmount: number;
  projectedAmount: number;
  committedAmount: number;
  remainingAmount: number;
  exceededAmount: number;
  usagePercentage: number;
  status: BudgetStatus;
};

export type BudgetSpending = {
  actualByCategory: Map<string, number>;
  projectedByCategory: Map<string, number>;
  uncategorizedActualAmount: number;
  uncategorizedProjectedAmount: number;
};

export type BudgetOverviewCalculation = {
  progressByCategory: Map<string, BudgetProgress>;
  allocatedAmount: number;
  actualSpentAmount: number;
  projectedAmount: number;
  committedAmount: number;
  availableAmount: number;
  exceededAmount: number;
  unbudgetedCommittedAmount: number;
  warningCount: number;
};

export function createBudgetDraft(input: {
  userId: string;
  categoryId: string;
  period: string;
  amount: number;
}): BudgetCreateDraft {
  return {
    userId: input.userId,
    categoryId: input.categoryId,
    period: input.period,
    amount: input.amount.toFixed(2),
  };
}

export function calculateBudgetProgress(
  limit: number,
  actualSpent: number,
  projected = 0,
): BudgetProgress {
  const normalizedLimit = Math.max(0, roundMoney(limit));
  const actualSpentAmount = Math.max(0, roundMoney(actualSpent));
  const projectedAmount = Math.max(0, roundMoney(projected));
  const committedAmount = roundMoney(actualSpentAmount + projectedAmount);
  const remainingAmount = roundMoney(Math.max(normalizedLimit - committedAmount, 0));
  const exceededAmount = roundMoney(Math.max(committedAmount - normalizedLimit, 0));
  const usagePercentage =
    normalizedLimit > 0 ? roundPercentage((committedAmount / normalizedLimit) * 100) : 0;
  const status = resolveBudgetStatus(normalizedLimit, committedAmount, usagePercentage);

  return {
    actualSpentAmount,
    projectedAmount,
    committedAmount,
    remainingAmount,
    exceededAmount,
    usagePercentage,
    status,
  };
}

export function calculateBudgetSpending(
  entries: BudgetSpendingEntry[],
  recurringRules: BudgetRecurringRule[],
  period: string,
): BudgetSpending {
  const actualByCategory = new Map<string, number>();
  const projectedByCategory = new Map<string, number>();
  let uncategorizedActualAmount = 0;
  let uncategorizedProjectedAmount = 0;

  for (const entry of entries) {
    if (
      entry.type !== "expense" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment"
    ) {
      continue;
    }
    if (entry.categoryId) addAmount(actualByCategory, entry.categoryId, entry.amount);
    else uncategorizedActualAmount += normalizedAmount(entry.amount);
  }

  for (const rule of recurringRules) {
    if (rule.type !== "expense" || rule.status !== "active") continue;

    for (const occurrencePeriod of [
      addMonthsToPeriod(period, -2),
      addMonthsToPeriod(period, -1),
      period,
    ]) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: occurrencePeriod,
      })) {
        const dueDate = getRecurringDueDate(rule.dueDate, purchaseDate);
        const transactionPeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate,
          card: rule.card,
        });

        if (transactionPeriod === period) {
          if (rule.categoryId) addAmount(projectedByCategory, rule.categoryId, rule.amount);
          else uncategorizedProjectedAmount += normalizedAmount(rule.amount);
        }
      }
    }
  }

  return {
    actualByCategory: roundedMap(actualByCategory),
    projectedByCategory: roundedMap(projectedByCategory),
    uncategorizedActualAmount: roundMoney(uncategorizedActualAmount),
    uncategorizedProjectedAmount: roundMoney(uncategorizedProjectedAmount),
  };
}

export function calculateBudgetOverview(
  budgetLimits: Array<{ categoryId: string; amount: string | number }>,
  spending: BudgetSpending,
): BudgetOverviewCalculation {
  const progressByCategory = new Map<string, BudgetProgress>();
  const budgetedCategoryIds = new Set(budgetLimits.map((budget) => budget.categoryId));
  let allocatedAmount = 0;
  let actualSpentAmount = 0;
  let projectedAmount = 0;
  let committedAmount = 0;
  let availableAmount = 0;
  let exceededAmount = 0;
  let warningCount = 0;

  for (const budget of budgetLimits) {
    const amount = Math.abs(Number(budget.amount));
    const progress = calculateBudgetProgress(
      amount,
      spending.actualByCategory.get(budget.categoryId) ?? 0,
      spending.projectedByCategory.get(budget.categoryId) ?? 0,
    );
    progressByCategory.set(budget.categoryId, progress);
    allocatedAmount += amount;
    actualSpentAmount += progress.actualSpentAmount;
    projectedAmount += progress.projectedAmount;
    committedAmount += progress.committedAmount;
    availableAmount += progress.remainingAmount;
    exceededAmount += progress.exceededAmount;
    if (progress.status !== "onTrack") warningCount += 1;
  }

  const unbudgetedCommittedAmount = roundMoney(
    spending.uncategorizedActualAmount +
      spending.uncategorizedProjectedAmount +
      unbudgetedTotal(spending.actualByCategory, budgetedCategoryIds) +
      unbudgetedTotal(spending.projectedByCategory, budgetedCategoryIds),
  );

  allocatedAmount = roundMoney(allocatedAmount);

  return {
    progressByCategory,
    allocatedAmount,
    actualSpentAmount: roundMoney(actualSpentAmount),
    projectedAmount: roundMoney(projectedAmount),
    committedAmount: roundMoney(committedAmount),
    availableAmount: roundMoney(availableAmount),
    exceededAmount: roundMoney(exceededAmount),
    unbudgetedCommittedAmount,
    warningCount,
  };
}

export function getPreviousBudgetPeriod(period: string) {
  return addMonthsToPeriod(period, -1);
}

function resolveBudgetStatus(limit: number, spent: number, usagePercentage: number): BudgetStatus {
  if (spent > limit) return "exceeded";
  if (spent === limit && limit > 0) return "reached";
  if (usagePercentage >= budgetWarningThreshold) return "warning";
  return "onTrack";
}

function addAmount(totals: Map<string, number>, categoryId: string, amount: string | number) {
  const numericAmount = normalizedAmount(amount);
  totals.set(categoryId, (totals.get(categoryId) ?? 0) + numericAmount);
}

function normalizedAmount(amount: string | number) {
  const numericAmount = Math.abs(Number(amount));
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function roundedMap(values: Map<string, number>) {
  return new Map([...values].map(([categoryId, amount]) => [categoryId, roundMoney(amount)]));
}

function unbudgetedTotal(values: Map<string, number>, budgetedCategoryIds: Set<string>) {
  return [...values].reduce(
    (total, [categoryId, amount]) =>
      budgetedCategoryIds.has(categoryId) ? total : total + Math.max(0, amount),
    0,
  );
}

function getRecurringDueDate(ruleDueDate: string | null, purchaseDate: string) {
  if (!ruleDueDate) return null;

  const purchase = new Date(`${purchaseDate}T00:00:00.000Z`);
  const dueDay = new Date(`${ruleDueDate}T00:00:00.000Z`).getUTCDate();
  const lastDay = new Date(
    Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth(), Math.min(dueDay, lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercentage(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

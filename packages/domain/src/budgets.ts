import type { CardClosingRule } from "./cards";
import { roundToTwoDecimals } from "./money";
import { getRecurringDueDate } from "./recurring-expenses";
import { getOccurrenceAmount, type SettlementAwareRule } from "./settlements";
import {
  addMonthsToPeriod,
  calculateExpenseImpact,
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

export type BudgetRecurringRule = SettlementAwareRule & {
  categoryId: string | null;
  type: TransactionType;
  amount: string | number;
  anchorDate: string;
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
  /** Committed share of all limits together, the same ratio each budget reports. */
  usagePercentage: number;
  unbudgetedCommittedAmount: number;
  unbudgetedItems: Array<{ categoryId: string | null; committedAmount: number }>;
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
  const normalizedLimit = Math.max(0, roundToTwoDecimals(limit));
  const actualSpentAmount = Math.max(0, roundToTwoDecimals(actualSpent));
  const projectedAmount = Math.max(0, roundToTwoDecimals(projected));
  const committedAmount = roundToTwoDecimals(actualSpentAmount + projectedAmount);
  const remainingAmount = roundToTwoDecimals(Math.max(normalizedLimit - committedAmount, 0));
  const exceededAmount = roundToTwoDecimals(Math.max(committedAmount - normalizedLimit, 0));
  const usagePercentage =
    normalizedLimit > 0 ? roundToOneDecimal((committedAmount / normalizedLimit) * 100) : 0;
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
    const expenseImpact = calculateExpenseImpact(entry);
    if (
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment" ||
      expenseImpact === 0
    ) {
      continue;
    }
    if (entry.categoryId) addSignedAmount(actualByCategory, entry.categoryId, expenseImpact);
    else uncategorizedActualAmount += expenseImpact;
  }

  for (const rule of recurringRules) {
    if (rule.type !== "expense" || rule.status !== "active") continue;

    for (const occurrencePeriod of [
      addMonthsToPeriod(period, -2),
      addMonthsToPeriod(period, -1),
      period,
      addMonthsToPeriod(period, 1),
    ]) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        dueDate: rule.dueDate,

        recurrenceEndDate: rule.configuredEndDate,

        anchorDate: rule.anchorDate,
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
          if (rule.categoryId)
            addAmount(
              projectedByCategory,
              rule.categoryId,
              getOccurrenceAmount(rule, purchaseDate, rule.amount),
            );
          else
            uncategorizedProjectedAmount += normalizedAmount(
              getOccurrenceAmount(rule, purchaseDate, rule.amount),
            );
        }
      }
    }
  }

  return {
    actualByCategory: roundedMap(actualByCategory),
    projectedByCategory: roundedMap(projectedByCategory),
    uncategorizedActualAmount: roundToTwoDecimals(uncategorizedActualAmount),
    uncategorizedProjectedAmount: roundToTwoDecimals(uncategorizedProjectedAmount),
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

  const unbudgetedItems = [
    ...new Set([...spending.actualByCategory.keys(), ...spending.projectedByCategory.keys()]),
  ]
    .filter((categoryId) => !budgetedCategoryIds.has(categoryId))
    .map((categoryId) => ({
      categoryId: categoryId as string | null,
      committedAmount: roundToTwoDecimals(
        Math.max(0, spending.actualByCategory.get(categoryId) ?? 0) +
          Math.max(0, spending.projectedByCategory.get(categoryId) ?? 0),
      ),
    }));
  unbudgetedItems.push({
    categoryId: null,
    committedAmount: Math.max(
      0,
      roundToTwoDecimals(
        spending.uncategorizedActualAmount + spending.uncategorizedProjectedAmount,
      ),
    ),
  });
  const positiveUnbudgetedItems = unbudgetedItems
    .filter((item) => item.committedAmount > 0)
    .sort((left, right) => right.committedAmount - left.committedAmount);
  const unbudgetedCommittedAmount = roundToTwoDecimals(
    positiveUnbudgetedItems.reduce((total, item) => total + item.committedAmount, 0),
  );

  allocatedAmount = roundToTwoDecimals(allocatedAmount);
  committedAmount = roundToTwoDecimals(committedAmount);

  return {
    progressByCategory,
    allocatedAmount,
    actualSpentAmount: roundToTwoDecimals(actualSpentAmount),
    projectedAmount: roundToTwoDecimals(projectedAmount),
    committedAmount,
    availableAmount: roundToTwoDecimals(availableAmount),
    exceededAmount: roundToTwoDecimals(exceededAmount),
    usagePercentage:
      allocatedAmount > 0 ? roundToOneDecimal((committedAmount / allocatedAmount) * 100) : 0,
    unbudgetedCommittedAmount: Math.max(0, unbudgetedCommittedAmount),
    unbudgetedItems: positiveUnbudgetedItems,
    warningCount,
  };
}

export function getPreviousBudgetPeriod(period: string) {
  return addMonthsToPeriod(period, -1);
}

/**
 * Recurring budgets. A rule repeats a category limit every month from `startPeriod` through the
 * inclusive `endPeriod` (open when `null`) and is expanded per queried month, never materialized.
 * The category is the identity of the series: versions are consecutive rules of one category, and
 * a monthly budget of a covered month is that month's adjustment, which wins over the rule.
 */
export const budgetRuleEditScopes = ["single", "future"] as const;
export type BudgetRuleEditScope = (typeof budgetRuleEditScopes)[number];

export type BudgetRuleVersion = {
  id: string;
  categoryId: string;
  amount: string | number;
  startPeriod: string;
  endPeriod: string | null;
};

export type BudgetRuleDraft = {
  userId: string;
  categoryId: string;
  amount: string;
  startPeriod: string;
  endPeriod: string | null;
};

export type MonthlyBudgetLimit = { id: string; categoryId: string; amount: string | number };

export type ResolvedBudgetLimit<
  TBudget extends MonthlyBudgetLimit,
  TRule extends BudgetRuleVersion,
> = {
  categoryId: string;
  amount: number;
  /** The month's own budget: a one-off limit, or the adjustment of a recurring one. */
  budget: TBudget | null;
  rule: TRule | null;
};

export const budgetRuleErrorCodes = [
  "budget_rule_overlap",
  "budget_rule_period_outside",
  "budget_already_exists",
] as const;
export type BudgetRuleErrorCode = (typeof budgetRuleErrorCodes)[number];

export class BudgetRuleError extends RangeError {
  readonly code: BudgetRuleErrorCode;

  constructor(code: BudgetRuleErrorCode) {
    super(code);
    this.code = code;
    this.name = "BudgetRuleError";
  }
}

/** `YYYY-MM` periods sort as text, so range checks need no date parsing. */
export function isBudgetRuleActiveInPeriod(
  rule: Pick<BudgetRuleVersion, "startPeriod" | "endPeriod">,
  period: string,
) {
  return rule.startPeriod <= period && (rule.endPeriod === null || rule.endPeriod >= period);
}

function rangesOverlap(
  left: Pick<BudgetRuleVersion, "startPeriod" | "endPeriod">,
  right: Pick<BudgetRuleVersion, "startPeriod" | "endPeriod">,
) {
  return (
    (left.endPeriod === null || left.endPeriod >= right.startPeriod) &&
    (right.endPeriod === null || right.endPeriod >= left.startPeriod)
  );
}

/** Throws when a candidate rule would share a month with another rule of the same category. */
export function assertBudgetRuleFits(
  candidate: Pick<BudgetRuleVersion, "categoryId" | "startPeriod" | "endPeriod">,
  existingRules: BudgetRuleVersion[],
  ignoredRuleIds: string[] = [],
) {
  const conflict = existingRules.some(
    (rule) =>
      rule.categoryId === candidate.categoryId &&
      !ignoredRuleIds.includes(rule.id) &&
      rangesOverlap(rule, candidate),
  );
  if (conflict) throw new BudgetRuleError("budget_rule_overlap");
}

export function createBudgetRuleDraft(input: {
  userId: string;
  categoryId: string;
  amount: number | string;
  startPeriod: string;
  endPeriod?: string | null;
}): BudgetRuleDraft {
  return {
    userId: input.userId,
    categoryId: input.categoryId,
    amount: Number(input.amount).toFixed(2),
    startPeriod: input.startPeriod,
    endPeriod: input.endPeriod ?? null,
  };
}

/** Limits that apply in `period`: the month's own budget first, then the rule in force. */
export function resolveBudgetLimits<
  TBudget extends MonthlyBudgetLimit,
  TRule extends BudgetRuleVersion,
>(
  period: string,
  rules: TRule[],
  monthlyBudgets: TBudget[],
): ResolvedBudgetLimit<TBudget, TRule>[] {
  const ruleByCategory = new Map<string, TRule>();
  for (const rule of rules) {
    if (!isBudgetRuleActiveInPeriod(rule, period)) continue;
    const current = ruleByCategory.get(rule.categoryId);
    // Rules never overlap; the latest start wins defensively if stored data ever does.
    if (!current || rule.startPeriod > current.startPeriod)
      ruleByCategory.set(rule.categoryId, rule);
  }

  const limits: ResolvedBudgetLimit<TBudget, TRule>[] = monthlyBudgets.map((budget) => ({
    categoryId: budget.categoryId,
    amount: Math.abs(Number(budget.amount)),
    budget,
    rule: ruleByCategory.get(budget.categoryId) ?? null,
  }));
  const budgetedCategoryIds = new Set(monthlyBudgets.map((budget) => budget.categoryId));
  for (const rule of ruleByCategory.values()) {
    if (budgetedCategoryIds.has(rule.categoryId)) continue;
    limits.push({
      categoryId: rule.categoryId,
      amount: Math.abs(Number(rule.amount)),
      budget: null,
      rule,
    });
  }
  return limits;
}

/** Monthly budgets a rule change removes: the adjustments of `categoryId` from a month on. */
export type BudgetAdjustmentRange = {
  categoryId: string;
  fromPeriod: string;
  toPeriod: string | null;
};

/**
 * Store operations of one rule change, applied together. Months before the selected one never
 * change, so a past limit stays what it was.
 */
export type BudgetRuleChange = {
  updateRule?: { id: string; amount?: string; endPeriod?: string | null };
  deleteRuleId?: string;
  insertRule?: BudgetRuleDraft;
  upsertMonthlyBudget?: BudgetCreateDraft;
  removeAdjustments?: BudgetAdjustmentRange;
};

function assertPeriodInsideRule(rule: BudgetRuleVersion, period: string) {
  if (!isBudgetRuleActiveInPeriod(rule, period)) {
    throw new BudgetRuleError("budget_rule_period_outside");
  }
}

/**
 * New amount for a recurring budget. `single` adjusts only `period`; `future` starts a new version
 * at `period` (or rewrites the rule when it starts there) and drops the adjustments it replaces.
 */
export function planBudgetRuleAmountChange(input: {
  userId: string;
  rule: BudgetRuleVersion;
  period: string;
  scope: BudgetRuleEditScope;
  amount: number;
}): BudgetRuleChange {
  const { rule, period } = input;
  assertPeriodInsideRule(rule, period);
  const amount = input.amount.toFixed(2);

  if (input.scope === "single") {
    return {
      upsertMonthlyBudget: { userId: input.userId, categoryId: rule.categoryId, period, amount },
    };
  }

  const removeAdjustments = {
    categoryId: rule.categoryId,
    fromPeriod: period,
    toPeriod: rule.endPeriod,
  };
  if (period === rule.startPeriod) {
    return { updateRule: { id: rule.id, amount }, removeAdjustments };
  }
  return {
    updateRule: { id: rule.id, endPeriod: addMonthsToPeriod(period, -1) },
    insertRule: createBudgetRuleDraft({
      userId: input.userId,
      categoryId: rule.categoryId,
      amount,
      startPeriod: period,
      endPeriod: rule.endPeriod,
    }),
    removeAdjustments,
  };
}

/** Ends a recurring budget from `period` on; a rule that starts there is removed entirely. */
export function planBudgetRuleStop(rule: BudgetRuleVersion, period: string): BudgetRuleChange {
  assertPeriodInsideRule(rule, period);
  const removeAdjustments = {
    categoryId: rule.categoryId,
    fromPeriod: period,
    toPeriod: rule.endPeriod,
  };
  if (period === rule.startPeriod) return { deleteRuleId: rule.id, removeAdjustments };
  return {
    updateRule: { id: rule.id, endPeriod: addMonthsToPeriod(period, -1) },
    removeAdjustments,
  };
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

function addSignedAmount(totals: Map<string, number>, categoryId: string, amount: number) {
  totals.set(categoryId, (totals.get(categoryId) ?? 0) + amount);
}

function normalizedAmount(amount: string | number) {
  const numericAmount = Math.abs(Number(amount));
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function roundedMap(values: Map<string, number>) {
  return new Map(
    [...values].map(([categoryId, amount]) => [categoryId, roundToTwoDecimals(amount)]),
  );
}

function roundToOneDecimal(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

import type { CardClosingRule } from "./cards";
import { expandCategoryIds, invoicePaymentCategoryName } from "./categories";
import { fromCents } from "./money";
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

export const categoryTrendChangeKinds = ["increase", "decrease", "stable", "started"] as const;

export type CategoryTrendType = "income" | "expense";
export type CategoryTrendChangeKind = (typeof categoryTrendChangeKinds)[number];

export type CategoryTrendCategory = {
  categoryId: string;
  parentId?: string | null;
  parentName?: string | null;
  isSystem?: boolean;
  name: string;
  icon: string | null;
  type: CategoryTrendType;
};

export type CategoryTrendActualEntry = {
  excludeFromBalance?: boolean;
  categoryId: string;
  origin?: TransactionOrigin;
  transactionType: TransactionType;
  type: CategoryTrendType;
  period: string;
  amount: string | number;
};

export type CategoryTrendRecurringRule = SettlementAwareRule & {
  excludeFromBalance?: boolean;
  occurrenceAccountExclusions?: Record<string, boolean>;
  isSettled?: boolean | null;
  categoryId: string;
  type: CategoryTrendType;
  amount: string | number;
  anchorDate: string;
  startDate: string;
  endDate?: string | null;
  frequency: RecurrenceFrequency;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  status: "active" | "paused" | "cancelled";
  card: { closingDay: number | null; closingRule?: CardClosingRule; dueDay: number } | null;
};

export type CategoryTrendPeriodOutput = {
  period: string;
  incomeAmount: number;
  expenseAmount: number;
  netAmount: number;
  actualAmount: number;
  recurringAmount: number;
};

export type CategoryTrendValueOutput = {
  period: string;
  actualAmount: number;
  recurringAmount: number;
  totalAmount: number;
  previousAmount: number;
  changeAmount: number;
  changePercentage: number | null;
  changeKind: CategoryTrendChangeKind;
};

export type CategoryTrendCategoryOutput = CategoryTrendCategory & {
  totalAmount: number;
  averageAmount: number;
  values: CategoryTrendValueOutput[];
  subcategories?: CategoryTrendCategoryOutput[];
  directCategory?: CategoryTrendCategoryOutput;
};

export type CategoryTrendsSummary = {
  periodCount: number;
  categoryCount: number;
  incomeAmount: number;
  expenseAmount: number;
  netAmount: number;
  actualAmount: number;
  recurringAmount: number;
  totalAmount: number;
  averageMonthlyIncomeAmount: number;
  averageMonthlyExpenseAmount: number;
  averageMonthlyNetAmount: number;
};

export type CategoryTrendsReport = {
  periods: CategoryTrendPeriodOutput[];
  categories: CategoryTrendCategoryOutput[];
  availableCategories: CategoryTrendCategory[];
  summary: CategoryTrendsSummary;
};

type CategoryPeriodAmounts = {
  actualCents: number;
  recurringCents: number;
};

type PeriodAmounts = CategoryPeriodAmounts & {
  incomeCents: number;
  expenseCents: number;
};

export function calculateCategoryTrends(input: {
  startPeriod: string;
  endPeriod: string;
  categoryIds?: readonly string[];
  categories: readonly CategoryTrendCategory[];
  actualEntries: readonly CategoryTrendActualEntry[];
  recurringRules: readonly CategoryTrendRecurringRule[];
  recurringOccurrenceScope?: "all" | "settled";
  excludeHiddenAccounts?: boolean;
}): CategoryTrendsReport {
  const periods = listPeriods(input.startPeriod, input.endPeriod);
  const lookbackPeriod = addMonthsToPeriod(input.startPeriod, -1);
  const selectedCategoryIds = input.categoryIds?.length
    ? new Set(
        expandCategoryIds(
          input.categories.map((category) => ({
            id: category.categoryId,
            parentId: category.parentId,
          })),
          input.categoryIds,
        ),
      )
    : null;
  const visibleCategories = input.categories
    .filter(
      (category) => category.name !== invoicePaymentCategoryName || category.isSystem === false,
    )
    .map((category) => ({
      ...category,
      parentId: category.parentId ?? null,
      parentName:
        input.categories.find((parent) => parent.categoryId === category.parentId)?.name ?? null,
    }));
  const availableCategories = visibleCategories
    .filter((category) => !selectedCategoryIds || selectedCategoryIds.has(category.categoryId))
    .sort(compareAvailableCategories);
  const categoryById = new Map(
    availableCategories.map((category) => [category.categoryId, category] as const),
  );
  const amountsByCategory = new Map<string, Map<string, CategoryPeriodAmounts>>();

  for (const entry of input.actualEntries) {
    if (input.excludeHiddenAccounts && entry.excludeFromBalance) continue;
    if (entry.period < lookbackPeriod || entry.period > input.endPeriod) continue;
    if (
      entry.transactionType === "transfer" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment"
    ) {
      continue;
    }
    const category = categoryById.get(entry.categoryId);
    if (!category || category.type !== entry.type) continue;
    const amount =
      category.type === "expense"
        ? calculateExpenseImpact({
            amount: entry.amount,
            origin: entry.origin ?? "regular",
            type: entry.transactionType,
          })
        : Math.abs(Number(entry.amount));
    if (amount === 0) continue;
    addCategoryAmount(
      amountsByCategory,
      entry.categoryId,
      entry.period,
      "actualCents",
      amount,
      true,
    );
  }

  for (const rule of input.recurringRules) {
    if (rule.status !== "active") continue;
    const category = categoryById.get(rule.categoryId);
    if (!category || category.type !== rule.type) continue;

    for (const purchasePeriod of listPeriods(
      addMonthsToPeriod(lookbackPeriod, -2),
      addMonthsToPeriod(input.endPeriod, 1),
    )) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        dueDate: rule.dueDate,

        recurrenceEndDate: rule.configuredEndDate,

        anchorDate: rule.anchorDate,
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      })) {
        if (
          input.excludeHiddenAccounts &&
          (rule.occurrenceAccountExclusions?.[purchaseDate] ?? rule.excludeFromBalance)
        )
          continue;
        if (
          input.recurringOccurrenceScope === "settled" &&
          (rule.occurrenceOverrides?.[purchaseDate]?.isSettled ?? rule.isSettled) !== true
        )
          continue;
        const transactionPeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: getRecurringDueDate(rule.dueDate, purchaseDate),
          card: rule.card,
        });

        if (transactionPeriod < lookbackPeriod || transactionPeriod > input.endPeriod) continue;
        addCategoryAmount(
          amountsByCategory,
          rule.categoryId,
          transactionPeriod,
          "recurringCents",
          getOccurrenceAmount(rule, purchaseDate, rule.amount),
        );
      }
    }
  }

  const directOutputs = availableCategories
    .map((category) =>
      buildCategoryOutput(
        category,
        periods,
        lookbackPeriod,
        amountsByCategory.get(category.categoryId),
      ),
    )
    .filter(
      (category) =>
        category.totalAmount !== 0 || category.values.some((value) => value.previousAmount !== 0),
    )
    .sort(compareCategoryOutputs);
  const selectedRoots = new Set(input.categoryIds ?? []);
  const categoryOutputs = availableCategories
    .filter(
      (category) =>
        !category.parentId ||
        (selectedRoots.has(category.categoryId) && !selectedRoots.has(category.parentId)),
    )
    .map((category) => {
      const children = availableCategories.filter(
        (child) => child.parentId === category.categoryId,
      );
      if (!children.length)
        return buildCategoryOutput(
          category,
          periods,
          lookbackPeriod,
          amountsByCategory.get(category.categoryId),
        );
      const combined = new Map<string, CategoryPeriodAmounts>();
      for (const id of [category.categoryId, ...children.map((child) => child.categoryId)]) {
        for (const [period, amounts] of amountsByCategory.get(id) ?? []) {
          const total = combined.get(period) ?? emptyCategoryPeriodAmounts();
          total.actualCents += amounts.actualCents;
          total.recurringCents += amounts.recurringCents;
          combined.set(period, total);
        }
      }
      return {
        ...buildCategoryOutput(category, periods, lookbackPeriod, combined),
        subcategories: directOutputs.filter((child) => child.parentId === category.categoryId),
        directCategory: buildCategoryOutput(
          category,
          periods,
          lookbackPeriod,
          amountsByCategory.get(category.categoryId),
        ),
      };
    })
    .filter(
      (category) =>
        category.totalAmount !== 0 ||
        category.values.some((value) => value.previousAmount !== 0) ||
        category.subcategories?.length,
    )
    .sort(compareCategoryOutputs);
  const periodAmounts = new Map(periods.map((period) => [period, emptyPeriodAmounts()] as const));

  for (const category of categoryOutputs) {
    for (const value of category.values) {
      const amounts = periodAmounts.get(value.period) as PeriodAmounts;
      amounts.actualCents += toSignedCents(value.actualAmount);
      amounts.recurringCents += toSignedCents(value.recurringAmount);
      if (category.type === "income") amounts.incomeCents += toSignedCents(value.totalAmount);
      else amounts.expenseCents += toSignedCents(value.totalAmount);
    }
  }

  const periodOutputs = periods.map((period) => {
    const amounts = periodAmounts.get(period) as PeriodAmounts;
    return {
      period,
      incomeAmount: fromCents(amounts.incomeCents),
      expenseAmount: fromCents(Math.max(0, amounts.expenseCents)),
      netAmount: fromCents(amounts.incomeCents - amounts.expenseCents),
      actualAmount: fromCents(amounts.actualCents),
      recurringAmount: fromCents(amounts.recurringCents),
    };
  });

  return {
    periods: periodOutputs,
    categories: categoryOutputs,
    availableCategories: visibleCategories.sort(compareAvailableCategories),
    summary: buildSummary(periodOutputs, categoryOutputs.length),
  };
}

function buildCategoryOutput(
  category: CategoryTrendCategory,
  periods: readonly string[],
  lookbackPeriod: string,
  amountsByPeriod: Map<string, CategoryPeriodAmounts> | undefined,
): CategoryTrendCategoryOutput {
  let previousCents = totalCents(amountsByPeriod?.get(lookbackPeriod));
  let totalCategoryCents = 0;
  const values = periods.map((period) => {
    const amounts = amountsByPeriod?.get(period) ?? emptyCategoryPeriodAmounts();
    const currentCents = totalCents(amounts);
    const change = calculateChange(currentCents, previousCents);
    totalCategoryCents += currentCents;
    const value: CategoryTrendValueOutput = {
      period,
      actualAmount: fromCents(amounts.actualCents),
      recurringAmount: fromCents(amounts.recurringCents),
      totalAmount: fromCents(currentCents),
      previousAmount: fromCents(previousCents),
      changeAmount: fromCents(currentCents - previousCents),
      changePercentage: change.percentage,
      changeKind: change.kind,
    };
    previousCents = currentCents;
    return value;
  });

  return {
    ...category,
    totalAmount: fromCents(totalCategoryCents),
    averageAmount: fromCents(
      Math.round(
        totalCategoryCents / Math.max(values.filter((value) => value.totalAmount !== 0).length, 1),
      ),
    ),
    values,
  };
}

function buildSummary(
  periods: readonly CategoryTrendPeriodOutput[],
  categoryCount: number,
): CategoryTrendsSummary {
  const totals = periods.reduce(
    (result, period) => {
      result.incomeCents += toAbsoluteCents(period.incomeAmount);
      result.expenseCents += toAbsoluteCents(period.expenseAmount);
      result.actualCents += toAbsoluteCents(period.actualAmount);
      result.recurringCents += toAbsoluteCents(period.recurringAmount);
      return result;
    },
    { incomeCents: 0, expenseCents: 0, actualCents: 0, recurringCents: 0 },
  );
  const periodCount = periods.length;
  // Averages follow the same rule as each category: only months with movement count.
  const incomePeriodCount = countPeriodsWithMovement(periods, ["incomeAmount"]);
  const expensePeriodCount = countPeriodsWithMovement(periods, ["expenseAmount"]);
  const movementPeriodCount = countPeriodsWithMovement(periods, ["incomeAmount", "expenseAmount"]);

  return {
    periodCount,
    categoryCount,
    incomeAmount: fromCents(totals.incomeCents),
    expenseAmount: fromCents(totals.expenseCents),
    netAmount: fromCents(totals.incomeCents - totals.expenseCents),
    actualAmount: fromCents(totals.actualCents),
    recurringAmount: fromCents(totals.recurringCents),
    totalAmount: fromCents(totals.actualCents + totals.recurringCents),
    averageMonthlyIncomeAmount: fromCents(Math.round(totals.incomeCents / incomePeriodCount)),
    averageMonthlyExpenseAmount: fromCents(Math.round(totals.expenseCents / expensePeriodCount)),
    averageMonthlyNetAmount: fromCents(
      Math.round((totals.incomeCents - totals.expenseCents) / movementPeriodCount),
    ),
  };
}

function countPeriodsWithMovement(
  periods: readonly CategoryTrendPeriodOutput[],
  amountKeys: readonly ("incomeAmount" | "expenseAmount")[],
) {
  const withMovement = periods.filter((period) =>
    amountKeys.some((key) => toAbsoluteCents(period[key]) !== 0),
  );
  return Math.max(withMovement.length, 1);
}

function calculateChange(
  currentCents: number,
  previousCents: number,
): { kind: CategoryTrendChangeKind; percentage: number | null } {
  if (previousCents === 0 && currentCents !== 0) return { kind: "started", percentage: null };
  if (currentCents === previousCents) return { kind: "stable", percentage: 0 };

  const percentage = roundToTwoDecimals(((currentCents - previousCents) / previousCents) * 100);
  return { kind: currentCents > previousCents ? "increase" : "decrease", percentage };
}

function addCategoryAmount(
  amountsByCategory: Map<string, Map<string, CategoryPeriodAmounts>>,
  categoryId: string,
  period: string,
  field: keyof CategoryPeriodAmounts,
  amount: string | number,
  signed = false,
) {
  const amountsByPeriod = amountsByCategory.get(categoryId) ?? new Map();
  const amounts = amountsByPeriod.get(period) ?? emptyCategoryPeriodAmounts();
  amounts[field] += signed ? toSignedCents(amount) : toAbsoluteCents(amount);
  amountsByPeriod.set(period, amounts);
  amountsByCategory.set(categoryId, amountsByPeriod);
}

function listPeriods(startPeriod: string, endPeriod: string) {
  const periods: string[] = [];
  for (let period = startPeriod; period <= endPeriod; period = addMonthsToPeriod(period, 1)) {
    periods.push(period);
  }
  return periods;
}

function compareAvailableCategories(left: CategoryTrendCategory, right: CategoryTrendCategory) {
  return (
    typeOrder(left.type) - typeOrder(right.type) ||
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }) ||
    left.categoryId.localeCompare(right.categoryId)
  );
}

function compareCategoryOutputs(
  left: CategoryTrendCategoryOutput,
  right: CategoryTrendCategoryOutput,
) {
  return (
    typeOrder(left.type) - typeOrder(right.type) ||
    right.totalAmount - left.totalAmount ||
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }) ||
    left.categoryId.localeCompare(right.categoryId)
  );
}

function typeOrder(type: CategoryTrendType) {
  return type === "expense" ? 0 : 1;
}

function totalCents(amounts: CategoryPeriodAmounts | undefined) {
  return amounts ? amounts.actualCents + amounts.recurringCents : 0;
}

function emptyCategoryPeriodAmounts(): CategoryPeriodAmounts {
  return { actualCents: 0, recurringCents: 0 };
}

function emptyPeriodAmounts(): PeriodAmounts {
  return { ...emptyCategoryPeriodAmounts(), incomeCents: 0, expenseCents: 0 };
}

function toAbsoluteCents(amount: string | number) {
  const numericAmount = Math.abs(Number(amount));
  return Number.isFinite(numericAmount) ? Math.round(numericAmount * 100) : 0;
}

function toSignedCents(amount: string | number) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? Math.round(numericAmount * 100) : 0;
}

function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

import { fromCents, toCents } from "./money";

export const aiDiagnosisStatuses = ["pending", "completed", "failed"] as const;
export type AiDiagnosisStatus = (typeof aiDiagnosisStatuses)[number];

export const aiDiagnosisFailureCodes = [
  "providerDisconnected",
  "providerLimitReached",
  "providerBusy",
  "invalidOutput",
  "serviceUnavailable",
  "runFailed",
  "timedOut",
  "interrupted",
  "canceled",
] as const;
export type AiDiagnosisFailureCode = (typeof aiDiagnosisFailureCodes)[number];

export const aiDiagnosisDailyLimit = 10;
export const aiDiagnosisHistoryLimit = 12;
/** A diagnosis still pending after this long is treated as lost (for example, an API restart). */
export const aiDiagnosisPendingTimeoutMs = 5 * 60_000;

export const aiDiagnosisSectionTones = ["positive", "neutral", "attention", "critical"] as const;
export type AiDiagnosisSectionTone = (typeof aiDiagnosisSectionTones)[number];

/**
 * How the diagnosis is written. It changes only the wording: numbers, section tones and actions
 * stay the same in every voice. `balanced` is the original warm and honest diagnosis.
 */
export const aiDiagnosisVoices = [
  "balanced",
  "direct",
  "encouraging",
  "sarcastic",
  "stern",
] as const;
export type AiDiagnosisVoice = (typeof aiDiagnosisVoices)[number];
export const defaultAiDiagnosisVoice: AiDiagnosisVoice = "balanced";

export const aiDiagnosisChartKinds = [
  "incomeExpenseHistory",
  "savingsRateHistory",
  "topExpenseCategories",
  "monthlyBalanceHistory",
] as const;
export type AiDiagnosisChartKind = (typeof aiDiagnosisChartKinds)[number];

/**
 * The closed catalog of actions a diagnosis may suggest. Every action only opens an existing
 * screen; none changes data on its own.
 */
export const aiDiagnosisActionKinds = [
  "reviewCategoryTransactions",
  "createCategoryBudget",
  "reviewBudgets",
  "reviewInvoices",
  "reviewBills",
  "reviewRecurringTransactions",
  "createGoal",
] as const;
export type AiDiagnosisActionKind = (typeof aiDiagnosisActionKinds)[number];

const categoryActionKinds: ReadonlySet<AiDiagnosisActionKind> = new Set([
  "reviewCategoryTransactions",
  "createCategoryBudget",
]);

export const aiDiagnosisMaximumActions = 5;
export const aiDiagnosisMaximumSections = 6;
export const aiDiagnosisTopCategoriesCount = 5;

export const financialHealthLevels = ["excellent", "good", "fair", "poor"] as const;
export type FinancialHealthLevel = (typeof financialHealthLevels)[number];

const targetSavingsRatePercent = 20;
const targetEmergencyFundMonths = 6;
const worstExpenseTrendPercent = 30;
const savingsScoreWeight = 30;
const emergencyFundScoreWeight = 30;
const expenseTrendScoreWeight = 20;
const attentionScoreWeight = 20;
const criticalAttentionPenalty = 6;
const warningAttentionPenalty = 2;

export type FinancialHealthMonth = {
  period: string;
  income: number;
  expenses: number;
};

export type FinancialHealthCategory = {
  categoryId: string;
  categoryName: string;
  amount: number;
  previousAmount: number;
};

export type FinancialHealthInput = {
  /** Oldest first, ending with the diagnosed period. */
  history: FinancialHealthMonth[];
  totalBalance: number;
  expenseCategories: FinancialHealthCategory[];
  attention: { critical: number; warning: number };
};

export type FinancialHealthIndicators = {
  savingsRate: number | null;
  averageSavingsRate: number | null;
  averageMonthlyExpenses: number | null;
  emergencyFundMonths: number | null;
  expenseTrend: number | null;
  topCategoryShare: number | null;
  criticalAttentionItems: number;
  warningAttentionItems: number;
};

export type FinancialHealthCharts = {
  incomeExpenseHistory: FinancialHealthMonth[];
  savingsRateHistory: Array<{ period: string; savingsRate: number | null }>;
  topExpenseCategories: Array<FinancialHealthCategory & { share: number }>;
  monthlyBalanceHistory: Array<{ period: string; balance: number }>;
};

export type FinancialHealth = {
  score: number;
  level: FinancialHealthLevel;
  indicators: FinancialHealthIndicators;
  charts: FinancialHealthCharts;
};

export type AiDiagnosisActionDraft = {
  kind: AiDiagnosisActionKind;
  label: string;
  reason: string;
  categoryId: string | null;
};

export function hasFinancialHealthData(input: FinancialHealthInput) {
  return input.history.some((month) => month.income > 0 || month.expenses > 0);
}

export function calculateFinancialHealth(input: FinancialHealthInput): FinancialHealth {
  const current = input.history.at(-1);
  const activeMonths = input.history.filter((month) => month.income > 0 || month.expenses > 0);
  const expenseMonths = input.history.filter((month) => month.expenses > 0);
  const averageMonthlyExpenses = expenseMonths.length
    ? fromCents(
        Math.round(
          expenseMonths.reduce((total, month) => total + toCents(month.expenses), 0) /
            expenseMonths.length,
        ),
      )
    : null;
  const indicators: FinancialHealthIndicators = {
    savingsRate: current ? savingsRateOf([current]) : null,
    averageSavingsRate: savingsRateOf(activeMonths),
    averageMonthlyExpenses,
    emergencyFundMonths:
      averageMonthlyExpenses && averageMonthlyExpenses > 0
        ? roundOneDecimal(Math.max(input.totalBalance, 0) / averageMonthlyExpenses)
        : null,
    expenseTrend: expenseTrendOf(input.history),
    topCategoryShare: topExpenseCategories(input.expenseCategories)[0]?.share ?? null,
    criticalAttentionItems: input.attention.critical,
    warningAttentionItems: input.attention.warning,
  };
  const score = scoreOf(indicators, expenseMonths.length > 0);

  return {
    score,
    level: levelOf(score),
    indicators,
    charts: {
      incomeExpenseHistory: input.history.map(({ period, income, expenses }) => ({
        period,
        income,
        expenses,
      })),
      savingsRateHistory: input.history.map((month) => ({
        period: month.period,
        savingsRate: savingsRateOf([month]),
      })),
      topExpenseCategories: topExpenseCategories(input.expenseCategories),
      monthlyBalanceHistory: monthlyBalanceHistoryOf(input.history),
    },
  };
}

/**
 * Fills charts added after a diagnosis was saved, so older reports render every chart. Each one
 * is derived from charts the diagnosis already holds.
 */
export function completeFinancialHealthCharts(
  health: Omit<FinancialHealth, "charts"> & {
    charts: Omit<FinancialHealthCharts, "monthlyBalanceHistory"> &
      Partial<Pick<FinancialHealthCharts, "monthlyBalanceHistory">>;
  },
): FinancialHealth {
  return {
    ...health,
    charts: {
      ...health.charts,
      monthlyBalanceHistory:
        health.charts.monthlyBalanceHistory ??
        monthlyBalanceHistoryOf(health.charts.incomeExpenseHistory),
    },
  };
}

function monthlyBalanceHistoryOf(history: FinancialHealthMonth[]) {
  return history.map(({ period, income, expenses }) => ({
    period,
    balance: fromCents(toCents(income) - toCents(expenses)),
  }));
}

/**
 * Keeps only actions from the catalog that the diagnosed data can back: category actions need one
 * of the user's categories, other actions never carry one, and repeated suggestions collapse.
 */
export function selectAllowedAiDiagnosisActions(
  actions: AiDiagnosisActionDraft[],
  allowedCategoryIds: ReadonlySet<string>,
): AiDiagnosisActionDraft[] {
  const seen = new Set<string>();
  const selected: AiDiagnosisActionDraft[] = [];

  for (const action of actions) {
    const needsCategory = categoryActionKinds.has(action.kind);
    if (needsCategory && !(action.categoryId && allowedCategoryIds.has(action.categoryId))) {
      continue;
    }
    const categoryId = needsCategory ? action.categoryId : null;
    const key = `${action.kind}:${categoryId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ ...action, categoryId });
    if (selected.length === aiDiagnosisMaximumActions) break;
  }

  return selected;
}

export function isAiDiagnosisPendingExpired(createdAt: Date, now: Date) {
  return now.getTime() - createdAt.getTime() >= aiDiagnosisPendingTimeoutMs;
}

function savingsRateOf(months: FinancialHealthMonth[]) {
  const incomeCents = months.reduce((total, month) => total + toCents(month.income), 0);
  if (incomeCents <= 0) return null;
  const expensesCents = months.reduce((total, month) => total + toCents(month.expenses), 0);
  return roundOneDecimal(((incomeCents - expensesCents) / incomeCents) * 100);
}

function expenseTrendOf(history: FinancialHealthMonth[]) {
  if (history.length < 2) return null;
  const middle = Math.floor(history.length / 2);
  const earlier = averageExpenseCents(history.slice(0, middle));
  const recent = averageExpenseCents(history.slice(history.length - middle));
  if (earlier <= 0) return null;
  return roundOneDecimal(((recent - earlier) / earlier) * 100);
}

function averageExpenseCents(months: FinancialHealthMonth[]) {
  return months.reduce((total, month) => total + toCents(month.expenses), 0) / months.length;
}

function topExpenseCategories(categories: FinancialHealthCategory[]) {
  const positive = categories.filter((category) => category.amount > 0);
  const totalCents = positive.reduce((total, category) => total + toCents(category.amount), 0);
  if (totalCents <= 0) return [];

  return [...positive]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, aiDiagnosisTopCategoriesCount)
    .map((category) => ({
      ...category,
      share: roundOneDecimal((toCents(category.amount) / totalCents) * 100),
    }));
}

function scoreOf(indicators: FinancialHealthIndicators, hasExpenses: boolean) {
  const savings =
    indicators.averageSavingsRate === null
      ? hasExpenses
        ? 0
        : savingsScoreWeight / 2
      : clampRatio(indicators.averageSavingsRate / targetSavingsRatePercent) * savingsScoreWeight;
  const emergencyFund =
    indicators.emergencyFundMonths === null
      ? emergencyFundScoreWeight / 2
      : clampRatio(indicators.emergencyFundMonths / targetEmergencyFundMonths) *
        emergencyFundScoreWeight;
  const expenseTrend =
    indicators.expenseTrend === null
      ? expenseTrendScoreWeight / 2
      : clampRatio(1 - indicators.expenseTrend / worstExpenseTrendPercent) *
        expenseTrendScoreWeight;
  const attention = Math.max(
    0,
    attentionScoreWeight -
      indicators.criticalAttentionItems * criticalAttentionPenalty -
      indicators.warningAttentionItems * warningAttentionPenalty,
  );

  return Math.round(savings + emergencyFund + expenseTrend + attention);
}

function levelOf(score: number): FinancialHealthLevel {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

function clampRatio(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function roundOneDecimal(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

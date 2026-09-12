import {
  calculateExpenseImpact,
  isExpenseReduction,
  type PaymentMethod,
  type TransactionCondition,
  type TransactionOrigin,
  type TransactionType,
} from "./transactions";

export const dashboardWidgetIds = [
  "accounts",
  "invoices",
  "bills",
  "payment-status",
  "recurring-expenses",
  "installments",
  "inbox",
  "person-settlements",
  "budgets",
  "income-expense-balance",
  "expense-categories",
  "category-trends",
  "income-categories",
  "category-transactions",
  "people",
  "payment-conditions",
  "payment-methods",
  "notes",
] as const;

const previousDefaultDashboardWidgetOrder = [
  "accounts",
  "invoices",
  "bills",
  "payment-status",
  "inbox",
  "external-expenses",
  "income-expense-balance",
  "budgets",
  "category-trends",
  "expense-categories",
  "income-categories",
  "category-transactions",
  "people",
  "payment-conditions",
  "payment-methods",
  "installments",
  "recurring-expenses",
  "notes",
] as const;

export type DashboardWidgetId = (typeof dashboardWidgetIds)[number];

export type DashboardWidgetPreferences = {
  hidden: DashboardWidgetId[];
  order: DashboardWidgetId[];
};

const dashboardWidgetIdSet = new Set<string>(dashboardWidgetIds);
const legacyDashboardWidgetIds: Readonly<Record<string, DashboardWidgetId>> = {
  "external-expenses": "person-settlements",
};

export function createDefaultDashboardWidgetPreferences(): DashboardWidgetPreferences {
  return { hidden: [], order: [...dashboardWidgetIds] };
}

export function normalizeDashboardWidgetPreferences(
  preferences?: { hidden: string[]; order: string[] } | null,
): DashboardWidgetPreferences {
  if (!preferences) return createDefaultDashboardWidgetPreferences();

  const recentDefaultOrder = [
    "accounts",
    "payment-status",
    "invoices",
    "bills",
    ...dashboardWidgetIds.slice(4),
  ];
  const migratedPreferenceOrder = preferences.order.map(
    (widgetId) => legacyDashboardWidgetIds[widgetId] ?? widgetId,
  );
  const wasPreviousDefaultOrder =
    preferences.order.length === previousDefaultDashboardWidgetOrder.length &&
    preferences.order.every((id, index) => id === previousDefaultDashboardWidgetOrder[index]);
  const wasRecentDefaultOrder =
    migratedPreferenceOrder.length === recentDefaultOrder.length &&
    migratedPreferenceOrder.every((id, index) => id === recentDefaultOrder[index]);
  const wasDefaultOrder = wasPreviousDefaultOrder || wasRecentDefaultOrder;
  const order = wasDefaultOrder
    ? [...dashboardWidgetIds]
    : uniqueDashboardWidgetIds(preferences.order);
  for (const widgetId of dashboardWidgetIds) {
    if (!order.includes(widgetId)) order.push(widgetId);
  }

  return {
    order,
    hidden: uniqueDashboardWidgetIds(preferences.hidden),
  };
}

function uniqueDashboardWidgetIds(widgetIds: string[]): DashboardWidgetId[] {
  return [
    ...new Set(widgetIds.map((widgetId) => legacyDashboardWidgetIds[widgetId] ?? widgetId)),
  ].filter((widgetId): widgetId is DashboardWidgetId => dashboardWidgetIdSet.has(widgetId));
}

export type DashboardMetricEntry = {
  accountId: string | null;
  amount: number;
  cardId: string | null;
  excludeFromBalance: boolean;
  forecastAmount: number;
  forecastPeriod: string | null;
  origin: DashboardTransactionOrigin;
  period: string;
  personRole: "admin" | "external";
  type: TransactionType;
};

export type DashboardTransactionOrigin = TransactionOrigin;

export type DashboardInvoicePaymentAllocation = {
  amount: number;
  cardId: string;
  period: string;
};

export type DashboardMetricPair = {
  current: number;
  hasPreviousData: boolean;
  previous: number;
};

export type DashboardMetrics = {
  balance: DashboardMetricPair;
  expenses: DashboardMetricPair;
  income: DashboardMetricPair;
  projected: DashboardMetricPair;
};

export type DashboardHistoryEntry = {
  balance: number;
  expenses: number;
  income: number;
  period: string;
};

export type DashboardPaymentStatusEntry = {
  adminAmount: number | null;
  isSettled: boolean;
  origin: DashboardTransactionOrigin;
  period: string;
  type: TransactionType;
};

export type DashboardPaymentStatusCategory = {
  confirmed: number;
  pending: number;
  total: number;
};

export type DashboardPaymentStatus = {
  expenses: DashboardPaymentStatusCategory;
  income: DashboardPaymentStatusCategory;
};

export type DashboardExpenseDistributionEntry = {
  amount: number;
  condition: TransactionCondition;
  origin: DashboardTransactionOrigin;
  paymentMethod: PaymentMethod;
  period: string;
  personRole: "admin" | "external";
  type: TransactionType;
};

export type DashboardExpenseDistributionItem<T extends string> = {
  amount: number;
  count: number;
  key: T;
  percentage: number;
};

export type DashboardExpenseDistribution = {
  conditions: DashboardExpenseDistributionItem<TransactionCondition>[];
  paymentMethods: DashboardExpenseDistributionItem<PaymentMethod>[];
  totalAmount: number;
  transactionCount: number;
};

export type DashboardCategoryBreakdownEntry = {
  amount: number;
  categoryId: string;
  categoryIcon: string | null;
  categoryName: string;
  origin: DashboardTransactionOrigin;
  period: string;
  personRole: "admin" | "external";
  type: TransactionType;
};

export type DashboardCategoryBreakdownItem = {
  amount: number;
  categoryId: string;
  categoryIcon: string | null;
  categoryName: string;
  count: number;
  percentage: number;
  previousAmount: number;
};

export type DashboardCategoryBreakdown = {
  expenses: DashboardCategoryBreakdownItem[];
  expensesTotal: number;
  income: DashboardCategoryBreakdownItem[];
  incomeTotal: number;
};

export type DashboardPersonExpenseEntry = {
  amount: number;
  excludeFromBalance: boolean;
  origin: DashboardTransactionOrigin;
  period: string;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: "admin" | "external";
  personStatus: "active" | "inactive";
  type: TransactionType;
};

export type DashboardPersonExpenseItem = {
  amount: number;
  count: number;
  percentage: number;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: "admin" | "external";
  personStatus: "active" | "inactive";
  previousAmount: number;
};

export type DashboardPeopleExpenses = {
  items: DashboardPersonExpenseItem[];
  totalAmount: number;
};

type DashboardPeriodCalculation = {
  balanceCents: number;
  expenseCents: number;
  incomeCents: number;
};

function toCents(value: number) {
  return Math.round(value * 100);
}

export function applyInvoicePaymentsToDashboardForecast(
  entries: DashboardMetricEntry[],
  payments: DashboardInvoicePaymentAllocation[],
): DashboardMetricEntry[] {
  const remainingPaidCentsByInvoice = new Map<string, number>();
  for (const payment of payments) {
    const key = `${payment.cardId}:${payment.period}`;
    remainingPaidCentsByInvoice.set(
      key,
      (remainingPaidCentsByInvoice.get(key) ?? 0) + toCents(payment.amount),
    );
  }

  return entries.map((entry) => {
    if (!entry.cardId || !entry.forecastPeriod || entry.forecastAmount >= 0) return entry;

    const key = `${entry.cardId}:${entry.forecastPeriod}`;
    const paidCents = remainingPaidCentsByInvoice.get(key) ?? 0;
    const forecastCents = toCents(entry.forecastAmount);
    const offsetCents = Math.min(Math.abs(forecastCents), paidCents);
    remainingPaidCentsByInvoice.set(key, paidCents - offsetCents);

    return { ...entry, forecastAmount: (forecastCents + offsetCents) / 100 };
  });
}

function contributesToProjected(entry: DashboardMetricEntry) {
  return (
    entry.personRole === "admin" &&
    entry.accountId !== null &&
    !entry.excludeFromBalance &&
    entry.forecastPeriod !== null &&
    entry.origin !== "invoicePayment" &&
    entry.origin !== "personSettlement"
  );
}

function calculatePeriod(entries: DashboardMetricEntry[], period: string) {
  let incomeCents = 0;
  let grossExpenseCents = 0;
  let expenseReductionCents = 0;
  let transferAdjustmentCents = 0;

  for (const entry of entries) {
    if (entry.period !== period) continue;

    if (
      entry.personRole !== "admin" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "personSettlement" ||
      entry.excludeFromBalance
    ) {
      continue;
    }

    const amountCents = toCents(entry.amount);

    if (entry.type === "transfer") {
      transferAdjustmentCents += amountCents;
      continue;
    }

    if (entry.origin === "accountBalanceAdjustment") continue;

    if (isExpenseReduction(entry)) {
      expenseReductionCents += Math.abs(amountCents);
      continue;
    }

    if (entry.type === "income") incomeCents += Math.abs(amountCents);
    if (entry.type === "expense") grossExpenseCents += Math.abs(amountCents);
  }

  const expenseCents = Math.max(0, grossExpenseCents - expenseReductionCents);
  const balanceCents =
    incomeCents - grossExpenseCents + expenseReductionCents + transferAdjustmentCents;

  return {
    balanceCents,
    expenseCents,
    incomeCents,
  };
}

function hasPeriodData(
  entries: DashboardMetricEntry[],
  period: string,
  metric: "balance" | "expenses" | "income" | "projected",
) {
  return entries.some((entry) => {
    if (metric === "projected") {
      return (
        entry.forecastPeriod === period &&
        contributesToProjected(entry) &&
        Math.abs(toCents(entry.forecastAmount)) > 0
      );
    }

    if (
      entry.excludeFromBalance ||
      entry.period !== period ||
      entry.personRole !== "admin" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "personSettlement" ||
      Math.abs(toCents(entry.amount)) === 0
    ) {
      return false;
    }

    if (entry.origin === "accountBalanceAdjustment") return false;
    if (metric === "balance") return true;
    if (metric === "expenses") return entry.type === "expense" || isExpenseReduction(entry);
    return entry.type === "income" && !isExpenseReduction(entry);
  });
}

export function calculatePeriodSummary(entries: DashboardMetricEntry[], period: string) {
  const calculation: DashboardPeriodCalculation = calculatePeriod(entries, period);
  return {
    balance: calculation.balanceCents / 100,
    expenses: calculation.expenseCents / 100,
    income: calculation.incomeCents / 100,
  };
}

function calculateProjectedBalance(
  entries: DashboardMetricEntry[],
  period: string,
  accountBalance: number,
) {
  const pendingCents = entries.reduce((total, entry) => {
    if (
      !contributesToProjected(entry) ||
      entry.forecastPeriod === null ||
      entry.forecastPeriod > period
    ) {
      return total;
    }

    return total + toCents(entry.forecastAmount);
  }, 0);

  return (toCents(accountBalance) + pendingCents) / 100;
}

export function calculateDashboardMetrics(input: {
  currentAccountBalance: number;
  currentPeriod: string;
  entries: DashboardMetricEntry[];
  previousAccountBalance: number;
  previousPeriod: string;
}): DashboardMetrics {
  const current = calculatePeriodSummary(input.entries, input.currentPeriod);
  const previous = calculatePeriodSummary(input.entries, input.previousPeriod);

  return {
    income: {
      current: current.income,
      hasPreviousData: hasPeriodData(input.entries, input.previousPeriod, "income"),
      previous: previous.income,
    },
    expenses: {
      current: current.expenses,
      hasPreviousData: hasPeriodData(input.entries, input.previousPeriod, "expenses"),
      previous: previous.expenses,
    },
    balance: {
      current: current.balance,
      hasPreviousData: hasPeriodData(input.entries, input.previousPeriod, "balance"),
      previous: previous.balance,
    },
    projected: {
      current: calculateProjectedBalance(
        input.entries,
        input.currentPeriod,
        input.currentAccountBalance,
      ),
      hasPreviousData:
        Math.abs(toCents(input.previousAccountBalance)) > 0 ||
        hasPeriodData(input.entries, input.previousPeriod, "projected"),
      previous: calculateProjectedBalance(
        input.entries,
        input.previousPeriod,
        input.previousAccountBalance,
      ),
    },
  };
}

export function calculateDashboardHistory(
  entries: DashboardMetricEntry[],
  periods: string[],
): DashboardHistoryEntry[] {
  return periods.map((period) => ({ period, ...calculatePeriodSummary(entries, period) }));
}

export function calculateDashboardPaymentStatus(
  entries: DashboardPaymentStatusEntry[],
  period: string,
): DashboardPaymentStatus {
  const cents = {
    income: { confirmed: 0, pending: 0 },
    expenses: { confirmed: 0, pending: 0 },
  };

  for (const entry of entries) {
    if (
      entry.period !== period ||
      entry.adminAmount === null ||
      entry.type === "transfer" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment"
    ) {
      continue;
    }

    const status = entry.isSettled ? "confirmed" : "pending";
    const amountCents = Math.abs(toCents(entry.adminAmount));

    if (isExpenseReduction({ ...entry, amount: entry.adminAmount })) {
      cents.expenses[status] -= amountCents;
      continue;
    }

    if (entry.type === "income") cents.income[status] += amountCents;
    if (entry.type === "expense") cents.expenses[status] += amountCents;
  }

  function category(values: { confirmed: number; pending: number }) {
    const confirmed = Math.max(0, values.confirmed);
    const pending = Math.max(0, values.pending);
    return {
      confirmed: confirmed / 100,
      pending: pending / 100,
      total: (confirmed + pending) / 100,
    };
  }

  return {
    income: category(cents.income),
    expenses: category(cents.expenses),
  };
}

export function calculateDashboardExpenseDistribution(
  entries: DashboardExpenseDistributionEntry[],
  period: string,
): DashboardExpenseDistribution {
  const included = entries.filter(
    (entry) =>
      entry.period === period &&
      entry.personRole === "admin" &&
      entry.origin !== "invoicePayment" &&
      entry.origin !== "accountBalanceAdjustment" &&
      calculateExpenseImpact(entry) !== 0,
  );
  const totalCents = Math.max(
    0,
    included.reduce((total, entry) => total + toCents(calculateExpenseImpact(entry)), 0),
  );

  return {
    totalAmount: totalCents / 100,
    transactionCount: included.length,
    conditions: groupExpenseDistribution(included, "condition", totalCents),
    paymentMethods: groupExpenseDistribution(included, "paymentMethod", totalCents),
  };
}

export function calculateDashboardCategoryBreakdown(
  entries: DashboardCategoryBreakdownEntry[],
  period: string,
  previousPeriod: string,
): DashboardCategoryBreakdown {
  const income = groupCategoryBreakdown(entries, "income", period, previousPeriod);
  const expenses = groupCategoryBreakdown(entries, "expense", period, previousPeriod);

  return {
    income: income.items,
    incomeTotal: income.total,
    expenses: expenses.items,
    expensesTotal: expenses.total,
  };
}

export function calculateDashboardPeopleExpenses(
  entries: DashboardPersonExpenseEntry[],
  period: string,
  previousPeriod: string,
): DashboardPeopleExpenses {
  const people = new Map<
    string,
    {
      amountCents: number;
      count: number;
      personAvatarUrl: string | null;
      personName: string;
      personRole: "admin" | "external";
      personStatus: "active" | "inactive";
      previousAmountCents: number;
    }
  >();

  for (const entry of entries) {
    if (
      entry.excludeFromBalance ||
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment" ||
      entry.origin === "personSettlement" ||
      (entry.period !== period && entry.period !== previousPeriod)
    ) {
      continue;
    }

    const isReduction = isExpenseReduction(entry);
    if (!isReduction && entry.type !== "expense") continue;

    const person = people.get(entry.personId) ?? {
      amountCents: 0,
      count: 0,
      personAvatarUrl: entry.personAvatarUrl,
      personName: entry.personName,
      personRole: entry.personRole,
      personStatus: entry.personStatus,
      previousAmountCents: 0,
    };
    const amountCents = Math.abs(toCents(entry.amount)) * (isReduction ? -1 : 1);

    if (entry.period === period) {
      person.amountCents += amountCents;
      person.count += 1;
    } else {
      person.previousAmountCents += amountCents;
    }
    people.set(entry.personId, person);
  }

  const totalCents = [...people.values()].reduce(
    (total, person) => total + Math.max(0, person.amountCents),
    0,
  );
  const items = [...people]
    .filter(([, person]) => person.amountCents > 0)
    .map(([personId, person]) => ({
      personId,
      personName: person.personName,
      personAvatarUrl: person.personAvatarUrl,
      personRole: person.personRole,
      personStatus: person.personStatus,
      amount: person.amountCents / 100,
      previousAmount: Math.max(0, person.previousAmountCents) / 100,
      count: person.count,
      percentage: Math.round((person.amountCents / totalCents) * 1_000) / 10,
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount || left.personName.localeCompare(right.personName),
    );

  return { items, totalAmount: totalCents / 100 };
}

function groupCategoryBreakdown(
  entries: DashboardCategoryBreakdownEntry[],
  type: "income" | "expense",
  period: string,
  previousPeriod: string,
) {
  const groups = new Map<
    string,
    {
      amountCents: number;
      categoryIcon: string | null;
      categoryName: string;
      count: number;
      previousAmountCents: number;
    }
  >();

  for (const entry of entries) {
    if (
      entry.personRole !== "admin" ||
      entry.type === "transfer" ||
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment" ||
      (entry.period !== period && entry.period !== previousPeriod)
    ) {
      continue;
    }

    const expenseImpact = calculateExpenseImpact(entry);
    if (
      type === "expense"
        ? expenseImpact === 0
        : entry.type !== "income" || isExpenseReduction(entry)
    ) {
      continue;
    }

    const group = groups.get(entry.categoryId) ?? {
      amountCents: 0,
      categoryIcon: entry.categoryIcon,
      categoryName: entry.categoryName,
      count: 0,
      previousAmountCents: 0,
    };
    const amountCents =
      type === "expense" ? toCents(expenseImpact) : Math.abs(toCents(entry.amount));

    if (entry.period === period) {
      group.amountCents += amountCents;
      group.count += 1;
    } else {
      group.previousAmountCents += amountCents;
    }
    groups.set(entry.categoryId, group);
  }

  const totalCents = [...groups.values()].reduce((total, group) => total + group.amountCents, 0);
  const items = [...groups]
    .filter(([, group]) => group.amountCents !== 0)
    .map(([categoryId, group]) => ({
      categoryId,
      categoryName: group.categoryName,
      categoryIcon: group.categoryIcon,
      amount: group.amountCents / 100,
      previousAmount: group.previousAmountCents / 100,
      count: group.count,
      percentage: totalCents > 0 ? Math.round((group.amountCents / totalCents) * 1_000) / 10 : 0,
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount || left.categoryName.localeCompare(right.categoryName),
    );

  return { items, total: Math.max(0, totalCents) / 100 };
}

function groupExpenseDistribution<
  Field extends "condition" | "paymentMethod",
  Key extends DashboardExpenseDistributionEntry[Field],
>(
  entries: DashboardExpenseDistributionEntry[],
  field: Field,
  totalCents: number,
): DashboardExpenseDistributionItem<Key>[] {
  const groups = new Map<Key, { amountCents: number; count: number }>();

  for (const entry of entries) {
    const key = entry[field] as Key;
    const group = groups.get(key) ?? { amountCents: 0, count: 0 };
    group.amountCents += toCents(calculateExpenseImpact(entry));
    group.count += 1;
    groups.set(key, group);
  }

  return [...groups]
    .filter(([, group]) => group.amountCents !== 0)
    .map(([key, group]) => ({
      key,
      amount: group.amountCents / 100,
      count: group.count,
      percentage: totalCents > 0 ? Math.round((group.amountCents / totalCents) * 1_000) / 10 : 0,
    }))
    .sort(
      (left, right) =>
        right.amount - left.amount || right.count - left.count || left.key.localeCompare(right.key),
    );
}

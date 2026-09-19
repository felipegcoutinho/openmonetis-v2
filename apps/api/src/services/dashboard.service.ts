import type { CardClosingRule } from "@openmonetis/domain/cards";
import {
  applyInvoicePaymentsToDashboardForecast,
  calculateDashboardCategoryBreakdown,
  calculateDashboardExpenseDistribution,
  calculateDashboardHistory,
  calculateDashboardMetrics,
  calculateDashboardPaymentStatus,
  calculateDashboardPeopleExpenses,
  createDefaultDashboardWidgetPreferences,
  type DashboardCategoryBreakdownEntry,
  type DashboardExpenseDistributionEntry,
  type DashboardMetricEntry,
  type DashboardPaymentStatusEntry,
  type DashboardPersonExpenseEntry,
  type DashboardTransactionOrigin,
  normalizeDashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import { getRecurringDueDate } from "@openmonetis/domain/recurring-expenses";
import {
  addMonthsToPeriod,
  buildTransferPostings,
  deriveTransactionCompetencePeriod,
  deriveTransactionForecastPeriod,
  deriveTransactionPeriod,
  getPeriodEndDate,
  getPeriodFromDate,
  listRecurrenceDatesInPeriod,
  normalizeTransactionAmount,
  type PaymentMethod,
  type RecurrenceFrequency,
  type TransactionType,
} from "@openmonetis/domain/transactions";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type {
  DashboardAccountsOutput,
  DashboardCategoryBreakdownOutput,
  DashboardExpenseDistributionOutput,
  DashboardMetricsOutput,
  DashboardPaymentStatusOutput,
  DashboardPeopleExpensesOutput,
  DashboardSnapshotOutput,
  DashboardWidgetPreferencesInput,
  DashboardWidgetPreferencesOutput,
} from "@openmonetis/validators/dashboard";

export type DashboardTransactionRecord = {
  id: string;
  accountId: string | null;
  adminAmount: string | null;
  amount: string;
  cardId: string | null;
  categoryId: string | null;
  categoryIcon: string | null;
  categoryName: string | null;
  condition: "single" | "installment" | "recurring";
  excludeFromBalance: boolean;
  isSettled: boolean;
  origin: DashboardTransactionOrigin;
  paymentMethod: PaymentMethod | null;
  purchaseDate: string;
  dueDate: string | null;
  boletoPaymentDate: string | null;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  period: string;
  personRole: "admin" | "external";
  personStatus: "active" | "inactive";
  type: TransactionType;
};

export type DashboardRecurringRuleRecord = {
  accountId: string | null;
  adminAmount: string | null;
  amount: string;
  categoryId: string | null;
  categoryIcon: string | null;
  categoryName: string | null;
  cardId: string | null;
  card: { closingDay: number | null; closingRule: CardClosingRule; dueDay: number } | null;
  dueDate: string | null;
  excludeFromBalance: boolean;
  frequency: RecurrenceFrequency;
  id: string;
  isSettled: boolean | null;
  origin: DashboardTransactionOrigin;
  paymentMethod: PaymentMethod;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: "admin" | "external";
  personStatus: "active" | "inactive";
  sourceAccountId: string | null;
  sourceExcludeFromBalance: boolean;
  startDate: string;
  endDate?: string | null;
  destinationAccountId: string | null;
  destinationExcludeFromBalance: boolean;
  type: TransactionType;
};

export type DashboardRepository = {
  deleteWidgetPreferences(userId: string): Promise<void>;
  findWidgetPreferences(userId: string): Promise<{ hidden: string[]; order: string[] } | null>;
  listInvoiceStatuses(
    userId: string,
    period: string,
  ): Promise<Array<{ cardId: string; isPaid: boolean; period: string }>>;
  listAdminInvoicePaymentAllocations(
    userId: string,
    period: string,
  ): Promise<Array<{ amount: string; cardId: string; period: string }>>;
  listRecurringOccurrenceStates(
    userId: string,
    periodEnd: Date,
  ): Promise<
    Array<{
      boletoPaymentDate: string | null;
      isSettled: boolean;
      purchaseDate: string;
      recurringRuleId: string;
    }>
  >;
  listRecurringRules(userId: string, periodEnd: Date): Promise<DashboardRecurringRuleRecord[]>;
  listRecurringPersonSplits(
    userId: string,
    periodEnd: Date,
  ): Promise<DashboardRecurringPersonSplitRecord[]>;
  listTransactionPersonSplits(
    userId: string,
    period: string,
  ): Promise<DashboardTransactionPersonSplitRecord[]>;
  listTransactionsThroughPeriod(
    userId: string,
    period: string,
    startPeriod?: string,
  ): Promise<DashboardTransactionRecord[]>;
  saveWidgetPreferences(
    userId: string,
    preferences: DashboardWidgetPreferencesOutput,
  ): Promise<void>;
};

type DashboardPersonSplitRecord = {
  amount: string;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  personRole: "admin" | "external";
  personStatus: "active" | "inactive";
};

type DashboardTransactionPersonSplitRecord = DashboardPersonSplitRecord & {
  transactionId: string;
};

type DashboardRecurringPersonSplitRecord = DashboardPersonSplitRecord & {
  recurringRuleId: string;
};

type DashboardAccountsReader = {
  list(userId: string, period: string): Promise<AccountOutput[]>;
};

function expandRecurringRules(
  rules: DashboardRecurringRuleRecord[],
  throughPeriod: string,
  fromPurchasePeriod?: string,
  occurrenceStates: Array<{
    boletoPaymentDate: string | null;
    isSettled: boolean;
    purchaseDate: string;
    recurringRuleId: string;
  }> = [],
  invoiceStatuses: Array<{ cardId: string; isPaid: boolean; period: string }> = [],
) {
  const occurrenceByRuleAndDate = new Map(
    occurrenceStates.map((occurrence) => [
      `${occurrence.recurringRuleId}:${occurrence.purchaseDate}`,
      occurrence,
    ]),
  );
  const invoiceStatusByCardAndPeriod = new Map(
    invoiceStatuses.map((invoice) => [`${invoice.cardId}:${invoice.period}`, invoice.isPaid]),
  );

  return rules.flatMap((rule) => {
    const ruleStartPeriod = getPeriodFromDate(rule.startDate);
    const startPeriod =
      fromPurchasePeriod && fromPurchasePeriod > ruleStartPeriod
        ? fromPurchasePeriod
        : ruleStartPeriod;
    const entries: DashboardTransactionRecord[] = [];

    for (
      let purchasePeriod = startPeriod;
      purchasePeriod <= throughPeriod;
      purchasePeriod = addMonthsToPeriod(purchasePeriod, 1)
    ) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      })) {
        const dueDate = getRecurringDueDate(rule.dueDate, purchaseDate);
        const period = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate,
          card: rule.card,
        });
        const occurrence = occurrenceByRuleAndDate.get(`${rule.id}:${purchaseDate}`);
        const isSettled =
          rule.paymentMethod === "credit_card"
            ? Boolean(rule.cardId && invoiceStatusByCardAndPeriod.get(`${rule.cardId}:${period}`))
            : (occurrence?.isSettled ?? rule.isSettled ?? false);
        const boletoPaymentDate = occurrence?.boletoPaymentDate ?? null;

        if (period <= throughPeriod) {
          if (rule.type === "transfer") {
            if (!rule.sourceAccountId || !rule.destinationAccountId) continue;
            entries.push(
              ...buildTransferPostings({
                sourceAccountId: rule.sourceAccountId,
                destinationAccountId: rule.destinationAccountId,
                amount: Number(rule.amount),
              }).map((posting) => ({
                id: rule.id,
                accountId: posting.accountId,
                adminAmount: rule.adminAmount,
                amount: posting.amount.toFixed(2),
                cardId: null,
                categoryId: rule.categoryId,
                categoryIcon: rule.categoryIcon,
                categoryName: rule.categoryName,
                condition: "recurring" as const,
                excludeFromBalance:
                  posting.direction === "outgoing"
                    ? rule.sourceExcludeFromBalance
                    : rule.destinationExcludeFromBalance,
                origin: rule.origin,
                paymentMethod: rule.paymentMethod,
                purchaseDate,
                dueDate,
                boletoPaymentDate,
                personAvatarUrl: rule.personAvatarUrl,
                personId: rule.personId,
                personName: rule.personName,
                isSettled,
                period,
                personRole: rule.personRole,
                personStatus: rule.personStatus,
                type: rule.type,
              })),
            );
            continue;
          }

          entries.push({
            id: rule.id,
            accountId: rule.accountId,
            adminAmount: rule.adminAmount,
            amount: normalizeTransactionAmount(rule.type, Number(rule.amount)).toFixed(2),
            cardId: rule.cardId,
            categoryId: rule.categoryId,
            categoryIcon: rule.categoryIcon,
            categoryName: rule.categoryName,
            condition: "recurring",
            excludeFromBalance: rule.excludeFromBalance,
            origin: rule.origin,
            paymentMethod: rule.paymentMethod,
            purchaseDate,
            dueDate,
            boletoPaymentDate,
            personAvatarUrl: rule.personAvatarUrl,
            personId: rule.personId,
            personName: rule.personName,
            isSettled,
            period,
            personRole: rule.personRole,
            personStatus: rule.personStatus,
            type: rule.type,
          });
        }
      }
    }

    return entries;
  });
}

function expandRecurringPaymentStatusEntries(input: {
  invoiceStatuses: Array<{ cardId: string; isPaid: boolean; period: string }>;
  occurrenceStates: Array<{
    boletoPaymentDate: string | null;
    isSettled: boolean;
    purchaseDate: string;
    recurringRuleId: string;
  }>;
  period: string;
  rules: DashboardRecurringRuleRecord[];
}) {
  const invoiceStatusByCard = new Map(
    input.invoiceStatuses.map((invoice) => [`${invoice.cardId}:${invoice.period}`, invoice.isPaid]),
  );
  const occurrenceStatusByRuleAndDate = new Map(
    input.occurrenceStates.map((occurrence) => [
      `${occurrence.recurringRuleId}:${occurrence.purchaseDate}`,
      occurrence.isSettled,
    ]),
  );

  return input.rules.flatMap((rule) => {
    if (rule.type === "transfer") return [];

    const startPeriod = getPeriodFromDate(rule.startDate);
    const entries: DashboardPaymentStatusEntry[] = [];

    for (
      let purchasePeriod = startPeriod;
      purchasePeriod <= input.period;
      purchasePeriod = addMonthsToPeriod(purchasePeriod, 1)
    ) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      })) {
        const period = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: getRecurringDueDate(rule.dueDate, purchaseDate),
          card: rule.card,
        });
        if (period !== input.period) continue;

        entries.push({
          adminAmount: rule.adminAmount === null ? null : Number(rule.adminAmount),
          isSettled:
            rule.paymentMethod === "credit_card"
              ? Boolean(rule.cardId && invoiceStatusByCard.get(`${rule.cardId}:${period}`))
              : (occurrenceStatusByRuleAndDate.get(`${rule.id}:${purchaseDate}`) ??
                rule.isSettled ??
                false),
          origin: rule.origin,
          period,
          type: rule.type,
        });
      }
    }

    return entries;
  });
}

function expandRecurringExpenseDistributionEntries(
  rules: DashboardRecurringRuleRecord[],
  period: string,
) {
  const purchasePeriods = [addMonthsToPeriod(period, -2), addMonthsToPeriod(period, -1), period];

  return rules.flatMap((rule) => {
    if (rule.adminAmount === null) return [];
    const entries: DashboardExpenseDistributionEntry[] = [];

    for (const purchasePeriod of purchasePeriods) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      })) {
        const transactionPeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: getRecurringDueDate(rule.dueDate, purchaseDate),
          card: rule.card,
        });
        const competencePeriod = deriveTransactionCompetencePeriod({
          paymentMethod: rule.paymentMethod,
          period: transactionPeriod,
          purchaseDate,
        });
        if (competencePeriod !== period) continue;

        entries.push({
          amount: normalizeTransactionAmount(rule.type, Number(rule.adminAmount)),
          condition: "recurring",
          origin: rule.origin,
          paymentMethod: rule.paymentMethod,
          period: competencePeriod,
          personRole: "admin",
          type: rule.type,
        });
      }
    }

    return entries;
  });
}

function buildPrimaryPersonMetricEntries(
  transactions: DashboardTransactionRecord[],
): DashboardMetricEntry[] {
  return transactions.map((transaction) => {
    const adminAmount = Number(transaction.adminAmount ?? 0);
    const amount =
      transaction.type === "transfer" || transaction.origin === "invoiceAdjustment"
        ? Math.sign(Number(transaction.amount)) * Math.abs(adminAmount)
        : normalizeTransactionAmount(transaction.type, adminAmount);
    const forecastPeriod = deriveTransactionForecastPeriod({
      dueDate: transaction.dueDate,
      isSettled: transaction.isSettled,
      paymentMethod: transaction.paymentMethod,
      period: transaction.period,
    });

    return {
      accountId: transaction.accountId,
      amount,
      cardId: transaction.cardId,
      excludeFromBalance: transaction.excludeFromBalance,
      forecastAmount: amount,
      forecastPeriod,
      origin: transaction.origin,
      period: deriveTransactionCompetencePeriod({
        paymentMethod: transaction.paymentMethod,
        period: transaction.period,
        purchaseDate: transaction.purchaseDate,
      }),
      personRole: transaction.adminAmount === null ? transaction.personRole : ("admin" as const),
      type: transaction.type,
    };
  });
}

function totalAccountBalance(accounts: AccountOutput[]) {
  return (
    accounts.reduce(
      (total, account) =>
        account.isArchived || account.excludeFromBalance
          ? total
          : total + Math.round(account.summary.balance * 100),
      0,
    ) / 100
  );
}

export function createDashboardService(
  repository: DashboardRepository,
  accountsReader: DashboardAccountsReader,
) {
  return {
    async getWidgetPreferences(userId: string): Promise<DashboardWidgetPreferencesOutput> {
      return normalizeDashboardWidgetPreferences(await repository.findWidgetPreferences(userId));
    },

    async updateWidgetPreferences(
      input: DashboardWidgetPreferencesInput,
      userId: string,
    ): Promise<DashboardWidgetPreferencesOutput> {
      const preferences = normalizeDashboardWidgetPreferences(input);
      await repository.saveWidgetPreferences(userId, preferences);
      return preferences;
    },

    async resetWidgetPreferences(userId: string): Promise<DashboardWidgetPreferencesOutput> {
      await repository.deleteWidgetPreferences(userId);
      return createDefaultDashboardWidgetPreferences();
    },

    async getSnapshot(period: string, userId: string): Promise<DashboardSnapshotOutput> {
      const transactionPromises = new Map<string, Promise<DashboardTransactionRecord[]>>();
      let recurringRulesPromise: Promise<DashboardRecurringRuleRecord[]> | undefined;
      let occurrenceStatesPromise:
        | Promise<
            Array<{
              boletoPaymentDate: string | null;
              isSettled: boolean;
              purchaseDate: string;
              recurringRuleId: string;
            }>
          >
        | undefined;
      let invoiceStatusesPromise:
        | Promise<Array<{ cardId: string; isPaid: boolean; period: string }>>
        | undefined;
      let adminInvoicePaymentsPromise:
        | Promise<Array<{ amount: string; cardId: string; period: string }>>
        | undefined;
      let transactionSplitsPromise: Promise<DashboardTransactionPersonSplitRecord[]> | undefined;
      let recurringSplitsPromise: Promise<DashboardRecurringPersonSplitRecord[]> | undefined;
      const accountPromises = new Map<string, Promise<AccountOutput[]>>();
      const end = getPeriodEndDate(period);

      const sharedRepository: DashboardRepository = {
        ...repository,
        listTransactionsThroughPeriod(_requestedUserId, requestedPeriod, startPeriod) {
          const key = `${requestedPeriod}:${startPeriod ?? ""}`;
          const cached = transactionPromises.get(key);
          if (cached) return cached;
          const request = repository.listTransactionsThroughPeriod(
            userId,
            requestedPeriod,
            startPeriod,
          );
          transactionPromises.set(key, request);
          return request;
        },
        listRecurringRules() {
          recurringRulesPromise ??= repository.listRecurringRules(userId, end);
          return recurringRulesPromise;
        },
        listRecurringOccurrenceStates() {
          occurrenceStatesPromise ??= repository.listRecurringOccurrenceStates(userId, end);
          return occurrenceStatesPromise;
        },
        listInvoiceStatuses() {
          invoiceStatusesPromise ??= repository.listInvoiceStatuses(userId, period);
          return invoiceStatusesPromise;
        },
        listAdminInvoicePaymentAllocations() {
          adminInvoicePaymentsPromise ??= repository.listAdminInvoicePaymentAllocations(
            userId,
            period,
          );
          return adminInvoicePaymentsPromise;
        },
        listTransactionPersonSplits() {
          transactionSplitsPromise ??= repository.listTransactionPersonSplits(userId, period);
          return transactionSplitsPromise;
        },
        listRecurringPersonSplits() {
          recurringSplitsPromise ??= repository.listRecurringPersonSplits(userId, end);
          return recurringSplitsPromise;
        },
      };
      const sharedAccountsReader: DashboardAccountsReader = {
        list(_requestedUserId, requestedPeriod) {
          const cached = accountPromises.get(requestedPeriod);
          if (cached) return cached;
          const request = accountsReader.list(userId, requestedPeriod);
          accountPromises.set(requestedPeriod, request);
          return request;
        },
      };
      const snapshotService = createDashboardService(sharedRepository, sharedAccountsReader);

      const [
        metrics,
        accounts,
        paymentStatus,
        expenseDistribution,
        categoryBreakdown,
        peopleExpenses,
      ] = await Promise.all([
        snapshotService.getMetrics(period, userId),
        snapshotService.getAccounts(period, userId),
        snapshotService.getPaymentStatus(period, userId),
        snapshotService.getExpenseDistribution(period, userId),
        snapshotService.getCategoryBreakdown(period, userId),
        snapshotService.getPeopleExpenses(period, userId),
      ]);

      return {
        metrics,
        accounts,
        paymentStatus,
        expenseDistribution,
        categoryBreakdown,
        peopleExpenses,
      };
    },

    async getMetrics(period: string, userId: string): Promise<DashboardMetricsOutput> {
      const previousPeriod = addMonthsToPeriod(period, -1);
      const historyPeriods = Array.from({ length: 6 }, (_, index) =>
        addMonthsToPeriod(period, index - 5),
      );
      const [
        transactions,
        recurringRules,
        occurrenceStates,
        invoiceStatuses,
        adminInvoicePayments,
        currentAccounts,
        previousAccounts,
      ] = await Promise.all([
        repository.listTransactionsThroughPeriod(userId, period),
        repository.listRecurringRules(userId, getPeriodEndDate(period)),
        repository.listRecurringOccurrenceStates(userId, getPeriodEndDate(period)),
        repository.listInvoiceStatuses(userId, period),
        repository.listAdminInvoicePaymentAllocations(userId, period),
        accountsReader.list(userId, period),
        accountsReader.list(userId, previousPeriod),
      ]);
      const entries = applyInvoicePaymentsToDashboardForecast(
        buildPrimaryPersonMetricEntries([
          ...transactions,
          ...expandRecurringRules(
            recurringRules,
            period,
            undefined,
            occurrenceStates,
            invoiceStatuses,
          ),
        ]),
        adminInvoicePayments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
      );

      return {
        period,
        previousPeriod,
        history: calculateDashboardHistory(entries, historyPeriods),
        ...calculateDashboardMetrics({
          currentAccountBalance: totalAccountBalance(currentAccounts),
          currentPeriod: period,
          entries,
          previousAccountBalance: totalAccountBalance(previousAccounts),
          previousPeriod,
        }),
      };
    },

    async getAccounts(period: string, userId: string): Promise<DashboardAccountsOutput> {
      const items = (await accountsReader.list(userId, period))
        .filter((account) => !account.isArchived)
        .map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          logo: account.logo,
          balance: account.summary.balance,
          excludeFromBalance: account.excludeFromBalance,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
      const totalBalanceCents = items.reduce(
        (total, account) =>
          account.excludeFromBalance ? total : total + Math.round(account.balance * 100),
        0,
      );

      return {
        period,
        scope: {
          accountingBasis: "cash",
          includePending: false,
          personScope: "primary",
        },
        totalBalance: totalBalanceCents / 100,
        items,
      };
    },

    async getPaymentStatus(period: string, userId: string): Promise<DashboardPaymentStatusOutput> {
      const end = getPeriodEndDate(period);
      const [transactions, recurringRules, occurrenceStates, invoiceStatuses] = await Promise.all([
        repository.listTransactionsThroughPeriod(userId, period, period),
        repository.listRecurringRules(userId, end),
        repository.listRecurringOccurrenceStates(userId, end),
        repository.listInvoiceStatuses(userId, period),
      ]);
      const entries: DashboardPaymentStatusEntry[] = [
        ...transactions.map((transaction) => ({
          adminAmount: transaction.adminAmount === null ? null : Number(transaction.adminAmount),
          isSettled: transaction.isSettled,
          origin: transaction.origin,
          period: transaction.period,
          type: transaction.type,
        })),
        ...expandRecurringPaymentStatusEntries({
          invoiceStatuses,
          occurrenceStates,
          period,
          rules: recurringRules,
        }),
      ];

      return { period, ...calculateDashboardPaymentStatus(entries, period) };
    },

    async getExpenseDistribution(
      period: string,
      userId: string,
    ): Promise<DashboardExpenseDistributionOutput> {
      const [transactions, recurringRules] = await Promise.all([
        repository.listTransactionsThroughPeriod(userId, period, period),
        repository.listRecurringRules(userId, getPeriodEndDate(period)),
      ]);
      const entries: DashboardExpenseDistributionEntry[] = [
        ...transactions.flatMap((transaction) =>
          transaction.adminAmount === null || transaction.paymentMethod === null
            ? []
            : [
                {
                  amount: Number(transaction.adminAmount),
                  condition: transaction.condition,
                  origin: transaction.origin,
                  paymentMethod: transaction.paymentMethod,
                  period: deriveTransactionCompetencePeriod({
                    paymentMethod: transaction.paymentMethod,
                    period: transaction.period,
                    purchaseDate: transaction.purchaseDate,
                  }),
                  personRole: "admin" as const,
                  type: transaction.type,
                },
              ],
        ),
        ...expandRecurringExpenseDistributionEntries(recurringRules, period),
      ];

      return { period, ...calculateDashboardExpenseDistribution(entries, period) };
    },

    async getCategoryBreakdown(
      period: string,
      userId: string,
    ): Promise<DashboardCategoryBreakdownOutput> {
      const previousPeriod = addMonthsToPeriod(period, -1);
      const [transactions, recurringRules] = await Promise.all([
        repository.listTransactionsThroughPeriod(userId, period, previousPeriod),
        repository.listRecurringRules(userId, getPeriodEndDate(period)),
      ]);
      const recurringTransactions = expandRecurringRules(
        recurringRules,
        period,
        addMonthsToPeriod(previousPeriod, -1),
      );
      const entries: DashboardCategoryBreakdownEntry[] = [
        ...transactions,
        ...recurringTransactions,
      ].flatMap((transaction) => {
        if (
          transaction.adminAmount === null ||
          transaction.categoryId === null ||
          transaction.categoryName === null
        ) {
          return [];
        }

        return [
          {
            amount: Number(transaction.adminAmount),
            categoryId: transaction.categoryId,
            categoryIcon: transaction.categoryIcon,
            categoryName: transaction.categoryName,
            origin: transaction.origin,
            period: deriveTransactionCompetencePeriod({
              paymentMethod: transaction.paymentMethod,
              period: transaction.period,
              purchaseDate: transaction.purchaseDate,
            }),
            personRole: "admin" as const,
            type: transaction.type,
          },
        ];
      });

      return {
        period,
        previousPeriod,
        ...calculateDashboardCategoryBreakdown(entries, period, previousPeriod),
      };
    },

    async getPeopleExpenses(
      period: string,
      userId: string,
    ): Promise<DashboardPeopleExpensesOutput> {
      const previousPeriod = addMonthsToPeriod(period, -1);
      const end = getPeriodEndDate(period);
      const [transactions, recurringRules, transactionSplits, recurringSplits] = await Promise.all([
        repository.listTransactionsThroughPeriod(userId, period, previousPeriod),
        repository.listRecurringRules(userId, end),
        repository.listTransactionPersonSplits(userId, period),
        repository.listRecurringPersonSplits(userId, end),
      ]);
      const transactionSplitsById = groupPersonSplits(transactionSplits, "transactionId");
      const recurringSplitsById = groupPersonSplits(recurringSplits, "recurringRuleId");
      const entries: DashboardPersonExpenseEntry[] = [
        ...buildPersonExpenseEntries(transactions, transactionSplitsById),
        ...buildPersonExpenseEntries(
          expandRecurringRules(recurringRules, period, addMonthsToPeriod(previousPeriod, -1)),
          recurringSplitsById,
        ),
      ];

      return {
        period,
        previousPeriod,
        ...calculateDashboardPeopleExpenses(entries, period, previousPeriod),
      };
    },
  };
}

function groupPersonSplits<
  Row extends DashboardPersonSplitRecord,
  Key extends "transactionId" | "recurringRuleId",
>(records: Array<Row & Record<Key, string>>, key: Key) {
  const groups = new Map<string, DashboardPersonSplitRecord[]>();
  for (const record of records) {
    const id = record[key];
    groups.set(id, [...(groups.get(id) ?? []), record]);
  }
  return groups;
}

function buildPersonExpenseEntries(
  transactions: DashboardTransactionRecord[],
  splitsById: Map<string, DashboardPersonSplitRecord[]>,
): DashboardPersonExpenseEntry[] {
  return transactions.flatMap((transaction) => {
    const splits = splitsById.get(transaction.id);
    const people = splits?.length
      ? splits
      : [
          {
            amount: transaction.amount,
            personAvatarUrl: transaction.personAvatarUrl,
            personId: transaction.personId,
            personName: transaction.personName,
            personRole: transaction.personRole,
            personStatus: transaction.personStatus,
          },
        ];

    return people.map((person) => ({
      amount: Number(person.amount),
      excludeFromBalance: transaction.excludeFromBalance,
      origin: transaction.origin,
      period: deriveTransactionCompetencePeriod({
        paymentMethod: transaction.paymentMethod,
        period: transaction.period,
        purchaseDate: transaction.purchaseDate,
      }),
      personAvatarUrl: person.personAvatarUrl,
      personId: person.personId,
      personName: person.personName,
      personRole: person.personRole,
      personStatus: person.personStatus,
      type: transaction.type,
    }));
  });
}

export type DashboardService = ReturnType<typeof createDashboardService>;

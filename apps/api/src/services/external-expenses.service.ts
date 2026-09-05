import {
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import type {
  ExternalExpenseSnapshot,
  ExternalExpenseSourceKind,
  ExternalExpenseStatus,
} from "@openmonetis/domain/external-expenses";
import {
  canDeliverRecurringOccurrence,
  getRecurringDueDate,
  getRecurringOccurrenceDeliveryDate,
  projectRecurringMonthAllocations,
  type RecurringAllocationRule,
} from "@openmonetis/domain/recurring-expenses";
import { deriveTransactionPeriod } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  ExternalExpenseOutput,
  ExternalExpensePageOutput,
  ExternalExpenseSummaryOutput,
  ImportExternalExpenseInput,
  ListExternalExpensesQuery,
} from "@openmonetis/validators/external-expenses";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { badRequest, conflict, notFound } from "../utils/errors";

export type ExternalExpenseRecord = {
  id: string;
  connectionId: string;
  ownerUserId: string;
  recipientUserId: string;
  sourceKind: ExternalExpenseSourceKind;
  sourceTransactionId: string | null;
  sourceSeriesId: string | null;
  sourceRecurringSeriesId: string | null;
  sourceRecurringRuleId: string | null;
  sourceOccurrenceDate: Date | null;
  importedTransactionId: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  status: ExternalExpenseStatus;
  sourceVersion: number;
  name: string;
  amount: string;
  purchaseDate: Date;
  period: string;
  dueDate: Date | null;
  sourcePaymentMethod: ExternalExpenseSnapshot["paymentMethod"];
  sourceCondition: ExternalExpenseSnapshot["condition"];
  installmentCount: number | null;
  currentInstallment: number | null;
  sourceLabel: string | null;
  sourceLogoUrl: string | null;
  sourceCardBrand: "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other" | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExternalExpensesRepository = {
  listForRecipient(
    recipientUserId: string,
    query: ListExternalExpensesQuery,
  ): Promise<{ items: ExternalExpenseRecord[]; total: number; totalAmount: number }>;
  findForRecipient(id: string, recipientUserId: string): Promise<ExternalExpenseRecord | null>;
  installmentAmountsForImport(input: {
    id: string;
    recipientUserId: string;
    expectedVersion: number;
  }): Promise<number[] | null>;
  summaryForRecipient(recipientUserId: string): Promise<ExternalExpenseSummaryRecord>;
  listRecurringSourcesForPeriod(
    period: string,
    ownerUserId?: string,
  ): Promise<RecurringExternalExpenseSourceRecord[]>;
  listActiveConnections(ownerUserId?: string): Promise<RecurringExternalExpenseConnectionRecord[]>;
  reconcileRecurringPeriod(input: {
    occurrencePeriod: string;
    ownerUserId?: string;
    drafts: RecurringExternalExpenseDraft[];
    changedAt: Date;
  }): Promise<RecurringExternalExpenseSyncResult>;
};

export type RecurringExternalExpenseSourceRecord = RecurringAllocationRule & {
  ownerUserId: string;
  seriesCreatedAt: Date;
  name: string;
  dueDate: string | null;
  paymentMethod: ExternalExpenseSnapshot["paymentMethod"];
  sourceLabel: string | null;
  card: {
    closingDay: number | null;
    closingRuleType: CardClosingRuleType;
    closingOffsetDays: number | null;
    closingOffsetMode: CardClosingOffsetMode | null;
    dueDay: number;
  } | null;
};

export type RecurringExternalExpenseConnectionRecord = {
  id: string;
  ownerUserId: string;
  personId: string;
  recipientUserId: string;
  connectedAt: Date;
};

export type RecurringExternalExpenseDraft = {
  connectionId: string;
  ownerUserId: string;
  recipientUserId: string;
  sourcePersonId: string;
  sourceRecurringSeriesId: string;
  sourceRecurringRuleId: string;
  sourceOccurrenceDate: string;
  snapshot: ExternalExpenseSnapshot;
};

export type RecurringExternalExpenseSyncResult = {
  created: number;
  updated: number;
  deleted: number;
};

export type ExternalExpenseSummaryRecord = {
  pendingCount: number;
  totalAmount: number;
  counterpartCount: number;
  latestCounterpartName: string | null;
  latestUpdatedAt: Date | null;
  latestPeriod: string | null;
};

type TransactionCreator = {
  createTransactionFromExternalExpense(
    data: TransactionInput,
    userId: string,
    externalExpenseId: string,
    expectedVersion: number,
    confirmedAt: Date,
    installmentAmounts?: number[],
  ): Promise<TransactionOutput>;
};

export async function synchronizeRecurringExternalExpenses(
  repository: ExternalExpensesRepository,
  input: { period?: string; ownerUserId?: string } = {},
  now: () => Date = () => new Date(),
): Promise<RecurringExternalExpenseSyncResult> {
  const changedAt = now();
  const businessDate = getCurrentDateInBrazil(changedAt);
  const period = input.period ?? getCurrentPeriodInBrazil(changedAt);
  if (period > getCurrentPeriodInBrazil(changedAt)) {
    return { created: 0, updated: 0, deleted: 0 };
  }
  const [sources, connections] = await Promise.all([
    repository.listRecurringSourcesForPeriod(period, input.ownerUserId),
    repository.listActiveConnections(input.ownerUserId),
  ]);
  const sourceByRuleId = new Map(sources.map((source) => [source.id, source]));
  const connectionByOwnerPerson = new Map(
    connections.map((connection) => [
      `${connection.ownerUserId}:${connection.personId}`,
      connection,
    ]),
  );
  const drafts = projectRecurringMonthAllocations({ period, rules: sources }).flatMap(
    (allocation) => {
      const source = sourceByRuleId.get(allocation.ruleId);
      if (!source) return [];
      const connection = connectionByOwnerPerson.get(
        `${source.ownerUserId}:${allocation.personId}`,
      );
      if (!connection) return [];
      const activationDate = [
        getCurrentDateInBrazil(source.seriesCreatedAt),
        getCurrentDateInBrazil(connection.connectedAt),
      ]
        .sort()
        .at(-1) as string;
      const dueDate = getRecurringDueDate(source.dueDate, allocation.occurrenceDate);
      const deliveryDate = getRecurringOccurrenceDeliveryDate({
        occurrenceDate: allocation.occurrenceDate,
        dueDate,
        paymentMethod: source.paymentMethod,
      });
      if (!canDeliverRecurringOccurrence({ activationDate, businessDate, deliveryDate })) return [];
      const snapshotPeriod = deriveTransactionPeriod({
        paymentMethod: source.paymentMethod,
        purchaseDate: allocation.occurrenceDate,
        dueDate,
        card: source.card
          ? {
              closingDay: source.card.closingDay,
              closingRule: resolveCardClosingRule(source.card),
              dueDay: source.card.dueDay,
            }
          : null,
      });

      return [
        {
          connectionId: connection.id,
          ownerUserId: source.ownerUserId,
          recipientUserId: connection.recipientUserId,
          sourcePersonId: allocation.personId,
          sourceRecurringSeriesId: allocation.seriesId,
          sourceRecurringRuleId: allocation.ruleId,
          sourceOccurrenceDate: allocation.occurrenceDate,
          snapshot: {
            name: source.name,
            amount: Math.abs(allocation.amount).toFixed(2),
            purchaseDate: allocation.occurrenceDate,
            period: snapshotPeriod,
            dueDate,
            paymentMethod: source.paymentMethod,
            condition: "recurring" as const,
            installmentCount: null,
            currentInstallment: null,
            sourceLabel: source.sourceLabel,
          },
        },
      ];
    },
  );

  return repository.reconcileRecurringPeriod({
    occurrencePeriod: period,
    ownerUserId: input.ownerUserId,
    drafts,
    changedAt,
  });
}

export function createExternalExpensesService(
  repository: ExternalExpensesRepository,
  options: { transactionCreator: TransactionCreator; now?: () => Date },
) {
  const now = options.now ?? (() => new Date());

  return {
    synchronizeRecurringPeriod: (input?: { period?: string; ownerUserId?: string }) =>
      synchronizeRecurringExternalExpenses(repository, input, now),
    async list(
      query: ListExternalExpensesQuery,
      recipientUserId: string,
    ): Promise<ExternalExpensePageOutput> {
      const result = await repository.listForRecipient(recipientUserId, query);

      return {
        items: result.items.map(toExpenseOutput),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalAmount: result.totalAmount,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      };
    },

    async get(id: string, recipientUserId: string) {
      return toExpenseOutput(await requiredExpense(id, recipientUserId, repository));
    },

    async summary(recipientUserId: string): Promise<ExternalExpenseSummaryOutput> {
      const summary = await repository.summaryForRecipient(recipientUserId);
      return {
        ...summary,
        latestUpdatedAt: summary.latestUpdatedAt?.toISOString() ?? null,
      };
    },

    async importExpense(id: string, recipientUserId: string, input: ImportExternalExpenseInput) {
      const current = await requiredExpense(id, recipientUserId, repository);
      if (current.status !== "pending") {
        throw conflict("External expense already reviewed", "external_expense_state_conflict");
      }
      if (current.sourceVersion !== input.expectedVersion) {
        throw conflict("External expense changed", "external_expense_version_conflict");
      }
      if (input.transaction.type !== "expense") {
        throw badRequest("Only expenses can be imported", "external_expense_type_invalid");
      }
      if (input.transaction.condition === "recurring") {
        throw badRequest(
          "Recurring external expenses are not supported",
          "external_expense_recurring_unsupported",
        );
      }
      if (
        current.sourceKind === "recurringOccurrence" &&
        input.transaction.condition !== "single"
      ) {
        throw badRequest(
          "Recurring occurrences must be imported as single transactions",
          "external_expense_recurring_occurrence_condition_invalid",
        );
      }

      const preservesSourceInstallments =
        current.sourceCondition === "installment" &&
        input.transaction.condition === "installment" &&
        input.transaction.installmentCount === current.installmentCount &&
        (input.transaction.startInstallment ?? 1) === current.currentInstallment &&
        Math.round(input.transaction.amount * 100) === Math.round(Number(current.amount) * 100);
      const installmentAmounts = preservesSourceInstallments
        ? await repository.installmentAmountsForImport({
            id,
            recipientUserId,
            expectedVersion: input.expectedVersion,
          })
        : null;
      const expectedInstallmentAmountCount =
        current.installmentCount !== null && current.currentInstallment !== null
          ? current.installmentCount - current.currentInstallment + 1
          : 0;
      if (
        preservesSourceInstallments &&
        (!installmentAmounts || installmentAmounts.length !== expectedInstallmentAmountCount)
      ) {
        throw conflict("External expense changed", "external_expense_version_conflict");
      }

      const transaction = await options.transactionCreator.createTransactionFromExternalExpense(
        input.transaction,
        recipientUserId,
        current.id,
        input.expectedVersion,
        now(),
        installmentAmounts ?? undefined,
      );
      const imported = await repository.findForRecipient(current.id, recipientUserId);
      if (imported?.status !== "imported") {
        throw conflict("External expense changed", "external_expense_version_conflict");
      }

      return { expense: toExpenseOutput(imported), transaction };
    },
  };
}

async function requiredExpense(
  id: string,
  recipientUserId: string,
  repository: ExternalExpensesRepository,
) {
  const expense = await repository.findForRecipient(id, recipientUserId);
  if (!expense) throw notFound("External expense not found", "external_expense_not_found");
  return expense;
}

function toDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function toExpenseOutput(record: ExternalExpenseRecord): ExternalExpenseOutput {
  return {
    id: record.id,
    connectionId: record.connectionId,
    sourceKind: record.sourceKind,
    sourceTransactionId: record.sourceTransactionId,
    sourceSeriesId: record.sourceSeriesId,
    sourceRecurringSeriesId: record.sourceRecurringSeriesId,
    sourceRecurringRuleId: record.sourceRecurringRuleId,
    sourceOccurrenceDate: toDate(record.sourceOccurrenceDate),
    importedTransactionId: record.importedTransactionId,
    counterpartName: record.ownerName,
    counterpartAvatarUrl: record.ownerAvatarUrl,
    status: record.status,
    sourceVersion: record.sourceVersion,
    snapshot: {
      name: record.name,
      amount: Math.abs(Number(record.amount)),
      purchaseDate: toDate(record.purchaseDate) as string,
      period: record.period,
      dueDate: toDate(record.dueDate),
      paymentMethod: record.sourcePaymentMethod,
      condition: record.sourceCondition,
      installmentCount: record.installmentCount,
      currentInstallment: record.currentInstallment,
      sourceLabel: record.sourceLabel,
    },
    sourceLogoUrl: record.sourceLogoUrl,
    sourceCardBrand: record.sourceCardBrand,
    importedAt: record.importedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type ExternalExpensesService = ReturnType<typeof createExternalExpensesService>;

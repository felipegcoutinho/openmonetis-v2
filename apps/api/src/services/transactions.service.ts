import { createHash, randomUUID } from "node:crypto";
import { isPayable } from "@openmonetis/domain/bills";
import {
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import {
  internalTransferCategoryName,
  invoicePaymentCategoryName,
} from "@openmonetis/domain/categories";
import {
  type DueDateRulesReader,
  emptyDueDateRulesReader,
  resolveDueDate,
} from "@openmonetis/domain/due-date-rules";
import {
  getNextRecurringOccurrenceDate,
  getRecurringDueDate,
} from "@openmonetis/domain/recurring-expenses";
import {
  isActiveRecurringOccurrence,
  RecurringTransitionError,
} from "@openmonetis/domain/recurring-transactions";
import { getOccurrenceAmount, SettlementError } from "@openmonetis/domain/settlements";
import { canAddTransactionTags, matchesTransactionTags } from "@openmonetis/domain/tags";
import type { ImportedStatement, ImportedTransaction } from "@openmonetis/domain/transactions";
import {
  addMonthsToDate,
  addMonthsToPeriod,
  allocateAmountProportionally,
  allocateInstallmentShares,
  allocateRefundByResponsibility,
  buildTrackedInstallmentSchedule,
  buildTransferPostings,
  calculateInstallmentEndPeriod,
  calculateRecurrenceEndDate,
  calculateRefund,
  canApplyBulkTransactionAction,
  canAssignBulkCategory,
  canDeleteTransactionOrigin,
  deriveImportedPeriod,
  deriveTransactionPeriod,
  deriveTransactionPostingDate,
  deriveTransactionPostingPeriod,
  getPeriodEndDate,
  getPeriodFromDate,
  InsufficientTransferBalanceError,
  listRecurrenceDatesInPeriod,
  normalizeImportedAmount,
  normalizeImportedDescriptionKey,
  normalizeImportedType,
  normalizeTransactionAmount,
  parseOfxStatement,
  previewInstallmentOptions,
  projectTransactionAllocations,
  resolveEditedTransactionPeriod,
  splitAmountIntoInstallments,
  toDisplayAmount,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  BulkCategorizeTransactionsInput,
  BulkDeleteTransactionsInput,
  BulkRenameTransactionsInput,
  BulkTagTransactionsInput,
  CreateTransactionRefundInput,
  ExportTransactionsQuery,
  ImportTransactionsInput,
  InstallmentOptionsQuery,
  ListTransactionsQuery,
  PreviewTransactionImportInput,
  RecurrenceEndDateQuery,
  RecurringOccurrenceActionInput,
  TransactionActionScope,
  TransactionInput,
  TransactionOutput,
  TransactionRefundOutput,
  UpdateRecurringRuleQuery,
  UpdateTransactionInput,
} from "@openmonetis/validators/transactions";
import { TransactionInputSchema } from "@openmonetis/validators/transactions";
import ExcelJS from "exceljs";
import type {
  RecurringRuleWithRelations,
  TransactionCreateRecord,
  TransactionUpdateRecord,
  TransactionWithRelations,
} from "../repositories/transactions.repository";
import { badRequest, conflict, notFound } from "../utils/errors";
import { createTransactionsExport } from "../utils/transactions-export";
import type { AttachmentsService } from "./attachments.service";

type TransactionsRepositoryModule = typeof import("../repositories/transactions.repository");

export type TransactionsServiceDependencies = Pick<
  TransactionsRepositoryModule,
  | "addTransactionsTagsForUser"
  | "copyTransactionAttachmentLinksForUser"
  | "deleteTransactionsForUser"
  | "deleteTransactionForUser"
  | "deleteTransactionImportBatchForUser"
  | "deleteTransactionSeriesForUser"
  | "deleteTransactionSeriesRangeForUser"
  | "deleteTransferPairForUser"
  | "findRecurringRuleByIdForUser"
  | "findInstallmentSeriesByIdForUser"
  | "findTransactionByIdForUser"
  | "getCardExpenseTotalForUser"
  | "insertImportedTransactions"
  | "insertInstallmentSeriesWithTransactions"
  | "insertRecurringRuleWithSplits"
  | "insertTransactionRefundForUser"
  | "insertTransactionsWithSplits"
  | "insertTransferWithBalanceCheck"
  | "listImportCategoryMappingsForUser"
  | "listImportedExternalIdsForUser"
  | "listPaidInvoicePeriodsForUser"
  | "listRecentEstablishmentNamesForUser"
  | "listRecurringOccurrencesForUser"
  | "listRecurringRulesByIdsForUser"
  | "listRecurringRulesForPeriod"
  | "listRecurringRulesBySeriesForUser"
  | "listRecurringSplitsForUser"
  | "listTransactionIdsWithAttachmentsForUser"
  | "listTransactionSeriesForUser"
  | "listBulkTransactionTargetsForUser"
  | "listTransactionSplitsForUser"
  | "listTransactionsByPeriod"
  | "removeTransactionsTagsForUser"
  | "renameTransactionsForUser"
  | "listTransactionsByDueDateRange"
  | "listAccountStatementTransactionsForUser"
  | "listTransactionsByPurchaseDateRange"
  | "listSettledRecurringBoletoOccurrencesByPaymentDateForUser"
  | "settleRecurringOccurrenceForUser"
  | "settleTransactionsForUser"
  | "updateRecurringRuleWithSplitsForUser"
  | "updateTransactionsCategoryForUser"
  | "updateTransactionSeriesRangeWithSplitsForUser"
  | "updateTransactionWithSplitsForUser"
  | "updateTransferPairForUser"
> & {
  dueDateRules?: DueDateRulesReader;
  transitionRecurringRuleForUser: typeof import("../repositories/recurring-transactions.repository").transitionRecurringRuleForUser;
  listTagsByIdsForUser?: (ids: string[], userId: string) => Promise<Array<{ id: string }>>;
  getAccountBalanceSnapshotForUser: (
    accountId: string,
    userId: string,
    period: string,
  ) => Promise<{ displayed: number; persisted: number }>;
  findAccountByIdForUser: typeof import("../repositories/accounts.repository").findAccountByIdForUser;
  findCardByIdForUser: typeof import("../repositories/cards.repository").findCardByIdForUser;
  findCategoryByIdForUser: typeof import("../repositories/categories.repository").findCategoryByIdForUser;
  findSystemCategoryByNameForUser: typeof import("../repositories/categories.repository").findSystemCategoryByNameForUser;
  listCategoriesByIdsForUser: typeof import("../repositories/categories.repository").listCategoriesByIdsForUser;
  listCategoryFamilyIdsForUser: typeof import("../repositories/categories.repository").listCategoryFamilyIdsForUser;
  findAdminPersonByUserId: typeof import("../repositories/people.repository").findAdminPersonByUserId;
  findPersonByIdForUser: typeof import("../repositories/people.repository").findPersonByIdForUser;
  listPeopleByIdsForUser: typeof import("../repositories/people.repository").listPeopleByIdsForUser;
};

type OwnershipContext = {
  person: { id: string; name: string };
  card: {
    id: string;
    name: string;
    closingDay: number | null;
    closingRuleType: CardClosingRuleType;
    closingOffsetDays: number | null;
    closingOffsetMode: CardClosingOffsetMode | null;
    closingDayPurchasesNextInvoice: boolean;
    dueDay: number;
    limit: string;
  } | null;
  category: { id: string; type: "income" | "expense" };
};

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function currentPeriod() {
  return getCurrentPeriodInBrazil();
}

function assertBoletoPaymentDateIsNotFuture(data: TransactionInput) {
  if (data.boletoPaymentDate && data.boletoPaymentDate > getCurrentDateInBrazil()) {
    throw badRequest("Boleto payment date cannot be in the future", "BOLETO_PAYMENT_DATE_FUTURE");
  }
}

const recentEstablishmentsLookbackMonths = 2;
const recentEstablishmentsLimit = 100;

async function translateTransferBalanceError<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SettlementError) throw badRequest("Invalid settlement", error.code);
    if (error instanceof RecurringTransitionError)
      throw badRequest("Invalid recurring schedule change", error.code);
    if (error instanceof InsufficientTransferBalanceError) {
      throw badRequest("Insufficient account balance", "INSUFFICIENT_TRANSFER_BALANCE");
    }
    throw error;
  }
}

type RecentEstablishmentsReader = {
  listRecentNamesForUser: (
    userId: string,
    dateStart: Date,
    dateEnd: Date,
    limit: number,
  ) => Promise<Array<{ name: string }>>;
};

function createRecentEstablishmentsService(
  reader: RecentEstablishmentsReader,
  now: () => Date = () => new Date(),
) {
  return {
    async list(userId: string) {
      const dateEnd = now();
      const dateStart = subtractUtcMonths(dateEnd, recentEstablishmentsLookbackMonths);
      const rows = await reader.listRecentNamesForUser(
        userId,
        dateStart,
        dateEnd,
        recentEstablishmentsLimit,
      );

      return { items: rows.map((row) => row.name) };
    },
  };
}

function subtractUtcMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return result;
}

export function createTransactionsService(
  dependencies: TransactionsServiceDependencies,
  attachmentCleaner: Pick<AttachmentsService, "cleanupOrphans">,
  recurringExternalExpenses: {
    synchronize(ownerUserId: string, period: string): Promise<unknown>;
  } = { synchronize: async () => undefined },
) {
  const dueDateRulesReader = dependencies.dueDateRules?.listVersions
    ? dependencies.dueDateRules
    : emptyDueDateRulesReader;
  const {
    addTransactionsTagsForUser,
    copyTransactionAttachmentLinksForUser,
    deleteTransactionForUser,
    deleteTransactionsForUser,
    deleteTransactionImportBatchForUser,
    deleteTransactionSeriesForUser,
    deleteTransactionSeriesRangeForUser,
    deleteTransferPairForUser,
    findAccountByIdForUser,
    findAdminPersonByUserId,
    findCardByIdForUser,
    findCategoryByIdForUser,
    findPersonByIdForUser,
    findRecurringRuleByIdForUser,
    findInstallmentSeriesByIdForUser,
    findSystemCategoryByNameForUser,
    findTransactionByIdForUser,
    getCardExpenseTotalForUser,
    getAccountBalanceSnapshotForUser,
    insertImportedTransactions,
    insertInstallmentSeriesWithTransactions,
    insertRecurringRuleWithSplits,
    insertTransactionRefundForUser,
    insertTransactionsWithSplits,
    insertTransferWithBalanceCheck,
    listCategoriesByIdsForUser,
    listCategoryFamilyIdsForUser,
    listImportCategoryMappingsForUser,
    listImportedExternalIdsForUser,
    listPaidInvoicePeriodsForUser,
    listPeopleByIdsForUser,
    listRecentEstablishmentNamesForUser,
    listRecurringOccurrencesForUser,
    listRecurringRulesByIdsForUser,
    listRecurringRulesForPeriod,
    listRecurringRulesBySeriesForUser,
    listRecurringSplitsForUser,
    listTransactionIdsWithAttachmentsForUser,
    listTransactionSeriesForUser,
    listBulkTransactionTargetsForUser,
    listTransactionSplitsForUser,
    listTransactionsByPeriod,
    removeTransactionsTagsForUser,
    renameTransactionsForUser,
    listTransactionsByDueDateRange,
    listAccountStatementTransactionsForUser,
    listTransactionsByPurchaseDateRange,
    listSettledRecurringBoletoOccurrencesByPaymentDateForUser,
    settleRecurringOccurrenceForUser,
    settleTransactionsForUser,
    updateRecurringRuleWithSplitsForUser,
    updateTransactionsCategoryForUser,
    updateTransactionSeriesRangeWithSplitsForUser,
    updateTransactionWithSplitsForUser,
    updateTransferPairForUser,
  } = dependencies;
  const recentEstablishmentsService = createRecentEstablishmentsService({
    listRecentNamesForUser: listRecentEstablishmentNamesForUser,
  });

  async function presentTransaction(
    item: TransactionOutput,
    userId: string,
    seriesId?: string,
    frozenDueDate?: string | null,
    frozenAdjustment?: import("@openmonetis/domain/due-date-rules").DueDateAdjustmentDetails | null,
  ) {
    const versions = await dueDateRulesReader.listVersions(userId);
    return {
      ...item,
      ...resolveDueDate(
        {
          dueDate: item.originalDueDate ?? item.dueDate,
          type: item.type,
          origin: item.origin,
          paymentMethod: item.paymentMethod,
          transactionId: item.recordId,
          seriesId,
          excluded: item.dueDateRuleExcluded,
          isSettled: item.isSettled,
          frozenDueDate,
          frozenAdjustment: frozenAdjustment ?? item.dueDateAdjustment,
        },
        versions,
      ),
    };
  }
  function listRecentEstablishments(userId: string) {
    return recentEstablishmentsService.list(userId);
  }

  function getPeriodStart(period: string) {
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  function getPreviousPeriod(period: string) {
    return addMonthsToPeriod(period, -1);
  }

  function getEarlierPeriod(period: string) {
    return addMonthsToPeriod(period, -2);
  }

  function toTransactionOutput(transaction: TransactionWithRelations): TransactionOutput {
    const amount = Number(transaction.amount);

    return {
      id: transaction.id,
      recordId: transaction.id,
      recurringRuleId: transaction.recurringRuleId,
      seriesId: transaction.seriesId,
      anticipationId: transaction.anticipationId,
      isRecurring: false,
      type: transaction.type,
      origin: transaction.origin,
      condition: transaction.condition,
      paymentMethod: transaction.paymentMethod,
      name: transaction.name,
      amount,
      displayAmount: toDisplayAmount(amount),
      plannedAmount: Math.abs(Number(transaction.plannedAmount ?? transaction.amount)),
      settledAmount:
        transaction.settledAmount == null ? null : Math.abs(Number(transaction.settledAmount)),
      settledDate: transaction.settledDate ? toDateString(transaction.settledDate) : null,
      allocation: null,
      purchaseDate: toDateString(transaction.purchaseDate),
      postingDate: deriveTransactionPostingDate({
        paymentMethod: transaction.paymentMethod,
        settledDate: transaction.settledDate ? toDateString(transaction.settledDate) : null,
        purchaseDate: toDateString(transaction.purchaseDate),
        dueDate: transaction.dueDate ? toDateString(transaction.dueDate) : null,
        boletoPaymentDate: transaction.boletoPaymentDate
          ? toDateString(transaction.boletoPaymentDate)
          : null,
        isSettled: transaction.isSettled,
      }),
      period: transaction.period,
      personId: transaction.personId,
      personName: transaction.personName,
      personAvatarUrl: transaction.personAvatarUrl,
      accountId: transaction.accountId,
      accountName: transaction.accountName,
      accountLogo: transaction.accountLogo,
      cardId: transaction.cardId,
      cardName: transaction.cardName,
      cardLogo: transaction.cardLogo,
      invoicePaymentCardName: transaction.invoicePaymentCardName,
      invoicePaymentCardLogo: transaction.invoicePaymentCardLogo,
      tagIds: transaction.tagIds ?? [],
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      categoryIcon: transaction.categoryIcon,
      sourceAccountId: transaction.sourceAccountId,
      sourceAccountName: transaction.sourceAccountName,
      sourceAccountLogo: transaction.sourceAccountLogo,
      destinationAccountId: transaction.destinationAccountId,
      destinationAccountName: transaction.destinationAccountName,
      destinationAccountLogo: transaction.destinationAccountLogo,
      dueDate: transaction.dueDate ? toDateString(transaction.dueDate) : null,
      originalDueDate: transaction.dueDate ? toDateString(transaction.dueDate) : null,
      dueDateRuleExcluded: transaction.dueDateRuleExcluded ?? false,
      dueDateAdjustment: transaction.dueDateAdjustment ?? null,
      boletoPaymentDate: transaction.boletoPaymentDate
        ? toDateString(transaction.boletoPaymentDate)
        : null,
      installmentCount: transaction.installmentCount,
      currentInstallment: transaction.currentInstallment,
      installmentEndPeriod:
        transaction.currentInstallment !== null && transaction.installmentCount !== null
          ? calculateInstallmentEndPeriod({
              installmentPeriod: transaction.installmentOriginalPeriod ?? transaction.period,
              currentInstallment: transaction.currentInstallment,
              totalInstallments: transaction.installmentCount,
            })
          : null,
      recurrenceFrequency: null,
      isSettled: transaction.isSettled,
      note: transaction.note,
      splitShares: [],
      isDivided: false,
      refundSourceId: transaction.refundSourceId,
      refundedAmount: Math.abs(Number(transaction.refundedAmount)),
      refundableAmount:
        transaction.type === "expense" && transaction.origin === "regular"
          ? Math.max(0, Math.abs(amount) - Math.abs(Number(transaction.refundedAmount)))
          : 0,
      hasAttachments: false,
      createdAt: toIsoString(transaction.createdAt),
      updatedAt: toIsoString(transaction.updatedAt),
    };
  }

  function toRecurringOccurrenceOutput(
    rule: RecurringRuleWithRelations,
    purchaseDate: string,
    period: string,
    dueDate = getRecurringDueDate(rule.dueDate ? toDateString(rule.dueDate) : null, purchaseDate),
  ): TransactionOutput {
    const amount = getOccurrenceAmount(rule, purchaseDate, rule.amount);
    const actual = rule.occurrenceOverrides?.[purchaseDate];

    return {
      id: `${rule.id}:${purchaseDate}`,
      recordId: null,
      recurringRuleId: rule.id,
      seriesId: null,
      anticipationId: null,
      isRecurring: true,
      type: rule.type,
      origin: "regular",
      condition: "recurring",
      paymentMethod: rule.paymentMethod,
      name: rule.name,
      amount,
      displayAmount: toDisplayAmount(amount),
      plannedAmount: Math.abs(Number(rule.amount)),
      settledAmount:
        actual?.isSettled && actual.amount != null ? Math.abs(Number(actual.amount)) : null,
      settledDate: actual?.isSettled ? (actual.settledDate ?? null) : null,
      allocation: null,
      purchaseDate,
      postingDate: deriveTransactionPostingDate({
        paymentMethod: rule.paymentMethod,
        settledDate: actual?.isSettled ? actual.settledDate : null,
        purchaseDate,
        dueDate,
        isSettled: actual?.isSettled ?? rule.isSettled,
      }),
      period,
      personId: rule.personId,
      personName: rule.personName,
      personAvatarUrl: rule.personAvatarUrl,
      accountId: rule.accountId,
      accountName: rule.accountName,
      accountLogo: rule.accountLogo,
      cardId: rule.cardId,
      cardName: rule.cardName,
      cardLogo: rule.cardLogo,
      invoicePaymentCardName: null,
      invoicePaymentCardLogo: null,
      tagIds: rule.tagIds ?? [],
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      categoryIcon: rule.categoryIcon,
      sourceAccountId: rule.sourceAccountId,
      sourceAccountName: rule.sourceAccountName,
      sourceAccountLogo: rule.sourceAccountLogo,
      destinationAccountId: rule.destinationAccountId,
      destinationAccountName: rule.destinationAccountName,
      destinationAccountLogo: rule.destinationAccountLogo,
      dueDate,
      originalDueDate: dueDate,
      dueDateRuleExcluded: actual?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded ?? false,
      dueDateAdjustment: actual?.dueDateAdjustment ?? null,
      boletoPaymentDate: null,
      installmentCount: null,
      currentInstallment: null,
      installmentEndPeriod: null,
      recurrenceFrequency: rule.frequency,
      recurrenceAnchorDate: toDateString(rule.anchorDate),

      recurrenceEndDate: rule.recurrenceEndDate ? toDateString(rule.recurrenceEndDate) : null,
      isSettled: actual?.isSettled ?? rule.isSettled,
      note: rule.note,
      splitShares: [],
      isDivided: false,
      refundSourceId: null,
      refundedAmount: 0,
      refundableAmount: 0,
      hasAttachments: false,
      createdAt: toIsoString(rule.createdAt),
      updatedAt: toIsoString(rule.updatedAt),
    };
  }

  async function assertOwnership(
    data: TransactionInput,
    userId: string,
  ): Promise<OwnershipContext> {
    if (data.tagIds?.length) {
      const ownedTags = await dependencies.listTagsByIdsForUser?.(data.tagIds, userId);
      if (!ownedTags || ownedTags.length !== data.tagIds.length)
        throw notFound("Tag not found", "tag_not_found");
    }
    const person =
      data.type === "transfer"
        ? await findAdminPersonByUserId(userId)
        : await findPersonByIdForUser(data.personId, userId);

    if (!person || person.status === "inactive") {
      throw notFound("Person not found", "PERSON_NOT_FOUND");
    }

    const category =
      data.type === "transfer"
        ? await findSystemCategoryByNameForUser(internalTransferCategoryName, userId)
        : await findCategoryByIdForUser(data.categoryId as string, userId);

    if (
      !category ||
      (data.type !== "transfer" &&
        (category.type !== data.type ||
          (category.name === invoicePaymentCategoryName && category.isSystem !== false)))
    ) {
      throw notFound("Category not found", "CATEGORY_NOT_FOUND");
    }

    if (data.accountId) {
      const account = await findAccountByIdForUser(data.accountId, userId);

      if (!account || account.isArchived) {
        throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
      }
    }

    if (data.sourceAccountId) {
      const account = await findAccountByIdForUser(data.sourceAccountId, userId);

      if (!account || account.isArchived) {
        throw notFound("Source account not found", "SOURCE_ACCOUNT_NOT_FOUND");
      }
    }

    if (data.destinationAccountId) {
      const account = await findAccountByIdForUser(data.destinationAccountId, userId);

      if (!account || account.isArchived) {
        throw notFound("Destination account not found", "DESTINATION_ACCOUNT_NOT_FOUND");
      }
    }

    const card = data.cardId ? await findCardByIdForUser(data.cardId, userId) : null;

    if (data.cardId && (!card || card.status === "inactive")) {
      throw notFound("Card not found", "CARD_NOT_FOUND");
    }

    for (const share of data.splitShares ?? []) {
      const splitPerson = await findPersonByIdForUser(share.personId, userId);
      if (!splitPerson || splitPerson.status === "inactive") {
        throw notFound("Split person not found", "SPLIT_PERSON_NOT_FOUND");
      }
    }

    return {
      person,
      card,
      category,
    };
  }

  function buildBaseRecord(
    data: TransactionInput & { userId: string },
    context: OwnershipContext,
  ): Omit<
    TransactionCreateRecord,
    "purchaseDate" | "period" | "amount" | "seriesId" | "installmentCount" | "currentInstallment"
  > {
    const isCreditCard = data.paymentMethod === "credit_card";
    const isTransfer = data.type === "transfer";
    if (data.settledDate && data.settledDate > getCurrentDateInBrazil())
      throw badRequest("Settlement date cannot be future", "SETTLEMENT_DATE_FUTURE");

    return {
      userId: data.userId,
      tagIds: data.tagIds,
      personId: context.person.id,
      type: data.type,
      origin: "regular",
      condition: data.condition,
      paymentMethod: data.paymentMethod,
      name: data.name,
      accountId: isCreditCard || isTransfer ? null : (data.accountId as string),
      cardId: isCreditCard ? (data.cardId as string) : null,
      categoryId: context.category.id,
      sourceAccountId: isTransfer ? (data.sourceAccountId as string) : null,
      destinationAccountId: isTransfer ? (data.destinationAccountId as string) : null,
      dueDate: data.dueDate ? toDate(data.dueDate) : null,
      dueDateRuleExcluded: data.dueDateRuleExcluded ?? false,
      boletoPaymentDate: data.boletoPaymentDate ? toDate(data.boletoPaymentDate) : null,
      settledDate:
        !isCreditCard && !isTransfer && data.condition !== "recurring" && data.isSettled
          ? toDate(data.settledDate ?? data.boletoPaymentDate ?? getCurrentDateInBrazil())
          : null,
      transferId: null,
      recurringRuleId: null,
      isSettled: isCreditCard ? null : (data.isSettled ?? false),
      note: normalizeNullableText(data.note),
      importSourceFingerprint: null,
      importExternalId: null,
      importBatchId: null,
    };
  }

  function derivePeriod(data: TransactionInput, context: OwnershipContext, purchaseDate: string) {
    if (data.paymentMethod === "credit_card" && data.invoicePeriod) return data.invoicePeriod;
    return deriveTransactionPeriod({
      paymentMethod: data.paymentMethod,
      purchaseDate,
      dueDate: data.dueDate,
      card: context.card
        ? {
            closingDay: context.card.closingDay,
            closingRule: resolveCardClosingRule(context.card),
            dueDay: Number(context.card.dueDay),
          }
        : null,
    });
  }

  async function previewTransactionImport(input: PreviewTransactionImportInput, userId: string) {
    const content = Buffer.from(input.contentBase64, "base64");
    if (!content.length || content.length > 5 * 1024 * 1024) {
      throw badRequest("Statement file is too large", "IMPORT_FILE_TOO_LARGE");
    }

    const extension = input.fileName.split(".").at(-1)?.toLowerCase();
    let statement: ImportedStatement;
    try {
      if (extension === "ofx" || extension === "qfx") {
        statement = parseOfxStatement(new TextDecoder("windows-1252").decode(content));
      } else if (extension === "xlsx") {
        statement = await parseSpreadsheetStatement(content);
      } else {
        throw badRequest("Statement format is not supported", "IMPORT_FORMAT_NOT_SUPPORTED");
      }
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      throw badRequest("Statement file could not be read", "IMPORT_FILE_INVALID");
    }
    if (statement.transactions.length > 1000) {
      throw badRequest("Statement has too many transactions", "IMPORT_TOO_MANY_ROWS");
    }

    const sourceFingerprint = createHash("sha256").update(statement.sourceReference).digest("hex");
    const externalIds = statement.transactions.flatMap((transaction) =>
      transaction.externalId ? [transaction.externalId] : [],
    );
    const descriptionKeys = [
      ...new Set(
        statement.transactions.map((transaction) =>
          normalizeImportedDescriptionKey(transaction.name),
        ),
      ),
    ];
    const [duplicateIds, categoryMappings] = await Promise.all([
      listImportedExternalIdsForUser(userId, sourceFingerprint, externalIds),
      listImportCategoryMappingsForUser(userId, descriptionKeys),
    ]);
    const duplicates = new Set(duplicateIds);
    const categoryMappingsByDescription = new Map(
      categoryMappings.map((mapping) => [mapping.descriptionKey, mapping]),
    );

    return {
      sourceName: statement.sourceName,
      sourceFingerprint,
      accountNumber: statement.accountNumber,
      period: statement.period,
      isCreditCard: statement.isCreditCard,
      transactions: statement.transactions.map((transaction) => ({
        ...transaction,
        isDuplicate: transaction.externalId ? duplicates.has(transaction.externalId) : false,
        suggestedCategoryId:
          categoryMappingsByDescription.get(normalizeImportedDescriptionKey(transaction.name))
            ?.categoryType === transaction.type
            ? (categoryMappingsByDescription.get(normalizeImportedDescriptionKey(transaction.name))
                ?.categoryId as string)
            : null,
      })),
    };
  }

  async function generateTransactionImportTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Lançamentos");
    sheet.addRows([
      ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
      ["01/07/2026", "Supermercado", 189.9, "despesa", "Alimentação"],
      ["05/07/2026", "Salário", 5000, "receita", "Salário"],
    ]);
    sheet.columns = [{ width: 14 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 24 }];
    for (let row = 2; row <= 1000; row += 1) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"despesa,receita"'],
      };
    }
    const content = await workbook.xlsx.writeBuffer();
    return {
      fileName: "modelo-importacao-lancamentos.xlsx",
      contentBase64: Buffer.from(content).toString("base64"),
    };
  }

  async function importTransactions(input: ImportTransactionsInput, userId: string) {
    const personIds = [...new Set(input.rows.map((row) => row.personId))];
    const categoryIds = [...new Set(input.rows.map((row) => row.categoryId))];
    const [ownedPeople, ownedCategories, account, card] = await Promise.all([
      listPeopleByIdsForUser(personIds, userId),
      listCategoriesByIdsForUser(categoryIds, userId),
      input.destinationType === "account"
        ? findAccountByIdForUser(input.destinationId, userId)
        : Promise.resolve(null),
      input.destinationType === "card"
        ? findCardByIdForUser(input.destinationId, userId)
        : Promise.resolve(null),
    ]);
    const peopleById = new Map(ownedPeople.map((person) => [person.id, person]));
    const categoriesById = new Map(ownedCategories.map((category) => [category.id, category]));

    if (input.rows.some((row) => peopleById.get(row.personId)?.status !== "active")) {
      throw notFound("Person not found", "PERSON_NOT_FOUND");
    }
    if (
      input.rows.some((row) => {
        const category = categoriesById.get(row.categoryId);
        return (
          !category ||
          category.type !== row.type ||
          (category.name === invoicePaymentCategoryName && category.isSystem !== false)
        );
      })
    ) {
      throw notFound("Category not found", "CATEGORY_NOT_FOUND");
    }
    if (input.destinationType === "account" && (!account || account.isArchived)) {
      throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    }
    if (input.destinationType === "card" && (!card || card.status === "inactive")) {
      throw notFound("Card not found", "CARD_NOT_FOUND");
    }

    if (card && input.invoicePeriod) {
      const paidPeriods = await listPaidInvoicePeriodsForUser(
        card.id,
        [input.invoicePeriod],
        userId,
      );
      if (paidPeriods.length) {
        throw badRequest("Paid invoices cannot receive transactions", "INVOICE_ALREADY_PAID");
      }
      const importedExpenses = input.rows
        .filter((row) => row.type === "expense")
        .reduce((total, row) => total + row.amount, 0);
      const used = await getCardExpenseTotalForUser(card.id, userId);
      if (used + importedExpenses > Number(card.limit)) {
        throw badRequest("Card limit exceeded", "CARD_LIMIT_EXCEEDED");
      }
    }

    const batchId = randomUUID();
    const records: TransactionCreateRecord[] = input.rows.map((row) => ({
      userId,
      personId: row.personId,
      type: row.type,
      origin: "regular",
      condition: "single",
      paymentMethod: input.paymentMethod,
      name: row.name,
      amount: normalizeTransactionAmount(row.type, row.amount).toFixed(2),
      purchaseDate: toDate(row.purchaseDate),
      period: input.invoicePeriod ?? getPeriodFromDate(row.purchaseDate),
      accountId: input.destinationType === "account" ? input.destinationId : null,
      cardId: input.destinationType === "card" ? input.destinationId : null,
      categoryId: row.categoryId,
      sourceAccountId: null,
      destinationAccountId: null,
      dueDate: null,
      boletoPaymentDate: null,
      installmentCount: null,
      currentInstallment: null,
      seriesId: null,
      transferId: null,
      recurringRuleId: null,
      isSettled: input.destinationType === "card" ? null : true,
      note: null,
      importSourceFingerprint: input.sourceFingerprint,
      importExternalId: row.externalId,
      importBatchId: batchId,
    }));
    const mappings = [
      ...new Map(
        input.rows.map((row) => [
          normalizeImportedDescriptionKey(row.name),
          {
            userId,
            descriptionKey: normalizeImportedDescriptionKey(row.name),
            categoryId: row.categoryId,
          },
        ]),
      ).values(),
    ];
    const inserted = await insertImportedTransactions(records, mappings);

    return { batchId, imported: inserted.length, skipped: records.length - inserted.length };
  }

  async function undoTransactionImport(batchId: string, userId: string) {
    const deleted = await deleteTransactionImportBatchForUser(batchId, userId);
    if (!deleted.length) throw notFound("Import batch not found", "IMPORT_BATCH_NOT_FOUND");
    return { batchId, deleted: deleted.length };
  }

  async function parseSpreadsheetStatement(content: Buffer): Promise<ImportedStatement> {
    const workbook = new ExcelJS.Workbook();
    const workbookData = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;
    await workbook.xlsx.load(workbookData);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) throw new Error("Spreadsheet has no rows");

    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => {
      headers.set(normalizeHeader(readSpreadsheetValue(cell.value)), column);
    });
    const dateColumn = findHeader(headers, ["data", "date"]);
    const nameColumn = findHeader(headers, ["descricao", "description", "historico"]);
    const amountColumn = findHeader(headers, ["valor", "amount"]);
    const typeColumn = findHeader(headers, ["tipo", "type"]);
    const categoryColumn = findHeader(headers, ["categoria", "category"]);
    if (!dateColumn || !nameColumn || !amountColumn) throw new Error("Required columns not found");

    const transactions: ImportedTransaction[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rawAmount = readSpreadsheetValue(row.getCell(amountColumn).value);
      const signedAmount = parseSignedSpreadsheetAmount(rawAmount);
      const amount = normalizeImportedAmount(rawAmount);
      const purchaseDate = parseSpreadsheetDate(row.getCell(dateColumn).value);
      const name = String(readSpreadsheetValue(row.getCell(nameColumn).value) ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      if (!purchaseDate || !name || !amount || amount <= 0) return;

      transactions.push({
        externalId: null,
        purchaseDate,
        amount,
        name,
        type: normalizeImportedType(
          typeColumn ? readSpreadsheetValue(row.getCell(typeColumn).value) : null,
          signedAmount,
        ),
        categoryName: categoryColumn
          ? String(readSpreadsheetValue(row.getCell(categoryColumn).value) ?? "").trim() || null
          : null,
      });
    });
    if (!transactions.length) throw new Error("Spreadsheet has no valid transactions");

    return {
      sourceName: "Planilha",
      sourceReference: `spreadsheet:${createHash("sha256").update(content).digest("hex")}`,
      accountNumber: null,
      period: deriveImportedPeriod(transactions),
      isCreditCard: false,
      transactions,
    };
  }

  function findHeader(headers: Map<string, number>, names: string[]) {
    return names.map((name) => headers.get(name)).find(Boolean) ?? null;
  }

  function normalizeHeader(value: unknown) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function readSpreadsheetValue(value: ExcelJS.CellValue): unknown {
    if (value && typeof value === "object") {
      if (value instanceof Date) return value;
      if ("result" in value) return value.result;
      if ("text" in value) return value.text;
      if ("richText" in value) return value.richText.map((item) => item.text).join("");
    }
    return value;
  }

  function parseSignedSpreadsheetAmount(value: unknown) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return undefined;
    const amount = normalizeImportedAmount(value);
    return amount === null ? undefined : value.includes("-") ? -amount : amount;
  }

  function parseSpreadsheetDate(value: ExcelJS.CellValue) {
    const raw = readSpreadsheetValue(value);
    if (raw instanceof Date) {
      return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, "0")}-${String(raw.getUTCDate()).padStart(2, "0")}`;
    }
    if (typeof raw === "number" && raw > 0) {
      const adjusted = raw > 60 ? raw - 1 : raw;
      return new Date(Date.UTC(1899, 11, 31) + adjusted * 86_400_000).toISOString().slice(0, 10);
    }
    const text = String(raw ?? "").trim();
    const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]?.padStart(2, "0")}-${dmy[1]?.padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  async function createTransaction(
    data: TransactionInput & { userId: string },
    confirmation?:
      | { source: "inbox"; sourceId: string; confirmedAt: Date }
      | {
          source: "externalExpense";
          sourceId: string;
          expectedVersion: number;
          confirmedAt: Date;
          installmentAmounts?: number[];
        },
  ) {
    assertBoletoPaymentDateIsNotFuture(data);
    const persistedConfirmation = confirmation
      ? { ...confirmation, userId: data.userId }
      : undefined;
    const context = await assertOwnership(data, data.userId);
    const base = buildBaseRecord(data, context);
    if (base.isSettled && data.dueDate) {
      const versions = await dueDateRulesReader.listVersions(data.userId);
      const resolved = resolveDueDate(
        {
          dueDate: data.dueDate,
          type: data.type,
          paymentMethod: data.paymentMethod,
          excluded: data.dueDateRuleExcluded,
        },
        versions,
      );
      base.frozenDueDate = resolved.dueDate ? toDate(resolved.dueDate) : null;
      base.dueDateAdjustment = resolved.dueDateAdjustment;
    }
    const signedAmount = normalizeTransactionAmount(data.type, data.amount);
    const basePeriod = derivePeriod(data, context, data.purchaseDate);
    const installmentCount =
      data.condition === "installment" ? (data.installmentCount as number) : null;
    const startInstallment = data.condition === "installment" ? (data.startInstallment ?? 1) : null;
    const installmentSchedule =
      installmentCount !== null && startInstallment !== null
        ? buildTrackedInstallmentSchedule({
            totalAmount: data.amount,
            installmentCount,
            startInstallment,
            basePeriod,
            dueDate: data.dueDate,
            paymentMethod: data.paymentMethod,
            initialSettlement: base.isSettled,
            trackedAmounts:
              confirmation?.source === "externalExpense"
                ? confirmation.installmentAmounts
                : undefined,
          })
        : null;

    if (context.card) {
      const periods = installmentSchedule
        ? installmentSchedule.map((installment) => installment.period)
        : [basePeriod];
      const paidPeriods = await listPaidInvoicePeriodsForUser(
        context.card.id,
        periods,
        data.userId,
      );
      if (paidPeriods.length)
        throw badRequest("Paid invoices cannot receive transactions", "INVOICE_ALREADY_PAID");
      if (data.type === "expense") {
        const used = await getCardExpenseTotalForUser(context.card.id, data.userId);
        const trackedAmount = installmentSchedule
          ? installmentSchedule.reduce(
              (totalCents, installment) => totalCents + Math.round(installment.amount * 100),
              0,
            ) / 100
          : data.amount;
        if (used + trackedAmount > Number(context.card.limit))
          throw badRequest("Card limit exceeded", "CARD_LIMIT_EXCEEDED");
      }
    }

    if (data.type === "transfer") {
      if (!data.sourceAccountId || !data.destinationAccountId) {
        throw badRequest("Transfer accounts are required", "TRANSFER_ACCOUNTS_REQUIRED");
      }

      const transferId = randomUUID();
      const postings = buildTransferPostings({
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        amount: data.amount,
      });
      const records = postings.map<TransactionCreateRecord>((posting) => ({
        ...base,
        condition: "single",
        accountId: posting.accountId,
        amount: posting.amount.toFixed(2),
        purchaseDate: toDate(data.purchaseDate),
        period: basePeriod,
        installmentCount: null,
        currentInstallment: null,
        seriesId: null,
        transferId,
      })) as [TransactionCreateRecord, TransactionCreateRecord];
      const balancePeriod = currentPeriod();
      const balanceSnapshot = base.isSettled
        ? await getAccountBalanceSnapshotForUser(data.sourceAccountId, data.userId, balancePeriod)
        : { displayed: 0, persisted: 0 };
      const transactions = await translateTransferBalanceError(() =>
        insertTransferWithBalanceCheck(
          records,
          balancePeriod,
          balanceSnapshot,
          persistedConfirmation,
        ),
      );
      const outgoingTransaction = transactions.find(
        (transaction) => Number(transaction?.amount) < 0,
      );

      if (!outgoingTransaction) {
        if (confirmation) {
          throw conflict(
            "The source item changed. Reload and try again",
            confirmation.source === "externalExpense"
              ? "external_expense_state_conflict"
              : "inbox_item_state_conflict",
          );
        }
        throw notFound("Transfer transaction not found", "TRANSFER_TRANSACTION_NOT_FOUND");
      }

      return presentTransaction(
        toTransactionOutput(outgoingTransaction),
        data.userId,
        undefined,
        outgoingTransaction.frozenDueDate ? toDateString(outgoingTransaction.frozenDueDate) : null,
      );
    }

    if (data.condition === "recurring") {
      if (confirmation) {
        throw badRequest(
          "Recurring rules cannot confirm source items",
          "SOURCE_RECURRING_TRANSACTION_UNSUPPORTED",
        );
      }
      const rule = await insertRecurringRuleWithSplits(
        {
          userId: data.userId,
          personId: context.person.id,
          type: data.type,
          paymentMethod: data.paymentMethod,
          name: data.name,
          amount: signedAmount.toFixed(2),
          anchorDate: toDate(data.purchaseDate),
          startDate: toDate(data.purchaseDate),
          endDate: null,
          recurrenceEndDate: data.recurrenceEndDate ? toDate(data.recurrenceEndDate) : null,
          frequency: data.recurrenceFrequency as NonNullable<
            TransactionInput["recurrenceFrequency"]
          >,
          accountId: base.accountId,
          cardId: base.cardId,
          categoryId: base.categoryId,
          tagIds: base.tagIds,
          sourceAccountId: base.sourceAccountId,
          destinationAccountId: base.destinationAccountId,
          dueDate: base.dueDate,
          dueDateRuleExcluded: base.dueDateRuleExcluded,
          isSettled: data.paymentMethod === "credit_card" ? null : false,
          note: base.note,
          status: "active",
        },
        (data.splitShares ?? []).map((share) => ({
          personId: share.personId,
          amount: normalizeTransactionAmount(data.type, share.amount).toFixed(2),
        })),
      );

      if (!rule) {
        throw notFound("Recurring transaction not found", "RECURRING_TRANSACTION_NOT_FOUND");
      }

      await synchronizeRecurringExternalExpensesFrom(data.userId, data.purchaseDate);

      return presentTransaction(
        toRecurringOccurrenceOutput(rule, data.purchaseDate, basePeriod),
        data.userId,
        rule.seriesId,
      );
    }

    if (installmentSchedule && installmentCount !== null && startInstallment !== null) {
      const seriesId = randomUUID();
      const records = installmentSchedule.map<TransactionCreateRecord>((installment, index) => ({
        ...base,
        condition: "installment",
        amount: normalizeTransactionAmount(data.type, installment.amount).toFixed(2),
        purchaseDate: toDate(data.purchaseDate),
        period: installment.period,
        dueDate: installment.dueDate ? toDate(installment.dueDate) : null,
        boletoPaymentDate: index === 0 && base.isSettled ? base.boletoPaymentDate : null,
        installmentCount,
        currentInstallment: installment.currentInstallment,
        seriesId,
        isSettled: installment.isSettled,
        frozenDueDate: installment.isSettled ? base.frozenDueDate : null,
      }));
      const splitShares = data.splitShares ?? [];
      const trackedTotal = installmentSchedule.reduce(
        (total, installment) => total + installment.amount,
        0,
      );
      const untrackedInstallmentCount = startInstallment - 1;
      const fullInstallmentAmounts = [
        ...(untrackedInstallmentCount > 0
          ? splitAmountIntoInstallments(data.amount - trackedTotal, untrackedInstallmentCount)
          : []),
        ...installmentSchedule.map((installment) => installment.amount),
      ];
      const installmentShares = splitShares.length
        ? allocateInstallmentShares(
            fullInstallmentAmounts,
            splitShares.map((share) => share.amount),
          )
        : [];
      const transactions = await insertInstallmentSeriesWithTransactions(
        {
          id: seriesId,
          userId: data.userId,
          totalInstallments: installmentCount,
          trackedFromInstallment: startInstallment,
          originalAmount: data.amount.toFixed(2),
        },
        records,
        installmentSchedule.flatMap((installment, transactionIndex) =>
          splitShares.map((share, shareIndex) => ({
            transactionIndex,
            personId: share.personId,
            amount: normalizeTransactionAmount(
              data.type,
              installmentShares[installment.currentInstallment - 1]?.[shareIndex] as number,
            ).toFixed(2),
          })),
        ),
        persistedConfirmation,
      );
      const firstTransaction = transactions[0];

      if (!firstTransaction) {
        if (confirmation) {
          throw conflict(
            "The source item changed. Reload and try again",
            confirmation.source === "externalExpense"
              ? "external_expense_state_conflict"
              : "inbox_item_state_conflict",
          );
        }
        throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
      }

      return presentTransaction(
        toTransactionOutput(firstTransaction),
        data.userId,
        undefined,
        firstTransaction.frozenDueDate ? toDateString(firstTransaction.frozenDueDate) : null,
      );
    }

    const [transaction] = await insertTransactionsWithSplits(
      [
        {
          ...base,
          condition: "single",
          amount: signedAmount.toFixed(2),
          purchaseDate: toDate(data.purchaseDate),
          period: derivePeriod(data, context, data.purchaseDate),
          installmentCount: null,
          currentInstallment: null,
          seriesId: null,
        },
      ],
      (data.splitShares ?? []).map((share) => ({
        transactionIndex: 0,
        personId: share.personId,
        amount: normalizeTransactionAmount(data.type, share.amount).toFixed(2),
      })),
      persistedConfirmation,
    );

    if (!transaction) {
      if (confirmation) {
        throw conflict(
          "The source item changed. Reload and try again",
          confirmation.source === "externalExpense"
            ? "external_expense_state_conflict"
            : "inbox_item_state_conflict",
        );
      }
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    return presentTransaction(
      toTransactionOutput(transaction),
      data.userId,
      undefined,
      transaction.frozenDueDate ? toDateString(transaction.frozenDueDate) : null,
    );
  }

  async function listTransactions(userId: string, query: ListTransactionsQuery, paginate = true) {
    if (query.categoryIds.length)
      query = {
        ...query,
        categoryIds: await listCategoryFamilyIdsForUser(query.categoryIds, userId),
      };
    const dueDateVersions = await dueDateRulesReader.listVersions(userId);
    const accountStatement = query.view === "accountStatement";
    const period = query.period ?? currentPeriod();
    const periodEnd = query.dateEnd ? toDate(query.dateEnd) : getPeriodEndDate(period);
    const periodStart = query.dateStart ? toDate(query.dateStart) : getPeriodStart(period);
    const persistedFilters = {
      type: query.type,
      condition: query.condition,
      paymentMethod: query.paymentMethod,
      personIds: query.personIds,
      categoryIds: query.categoryIds,
      accountIds: query.accountIds,
      cardIds: query.cardIds,
      hasAttachments: query.hasAttachments,
      isDivided: query.isDivided,
    };
    const [transactions, scheduledRecurringRules, paidBoletoOccurrences] = await Promise.all([
      accountStatement
        ? listAccountStatementTransactionsForUser(
            userId,
            period,
            periodStart,
            periodEnd,
            Boolean(query.dateStart || query.dateEnd),
            persistedFilters,
          )
        : query.dateStart || query.dateEnd
          ? listTransactionsByPurchaseDateRange(
              userId,
              query.dateStart ? toDate(query.dateStart) : undefined,
              query.dateEnd ? toDate(query.dateEnd) : undefined,
              persistedFilters,
            )
          : query.payables
            ? listTransactionsByDueDateRange(
                userId,
                `${addMonthsToPeriod(period, -13)}-01`,
                toDateString(getPeriodEndDate(addMonthsToPeriod(period, 13))),
              )
            : listTransactionsByPeriod(userId, period, persistedFilters),
      listRecurringRulesForPeriod(
        userId,
        query.payables ? getPeriodEndDate(addMonthsToPeriod(period, 13)) : periodEnd,
      ),
      accountStatement
        ? listSettledRecurringBoletoOccurrencesByPaymentDateForUser(
            userId,
            query.accountIds[0] as string,
            periodStart,
            periodEnd,
          )
        : Promise.resolve([]),
    ]);
    const scheduledRuleIds = new Set(scheduledRecurringRules.map((rule) => rule.id));
    const additionalRuleIds = [
      ...new Set(paidBoletoOccurrences.map((occurrence) => occurrence.recurringRuleId)),
    ].filter((id) => !scheduledRuleIds.has(id));
    const additionalRules = additionalRuleIds.length
      ? await listRecurringRulesByIdsForUser(userId, additionalRuleIds)
      : [];
    const recurringRules = [...scheduledRecurringRules, ...additionalRules];
    const rulesById = new Map(recurringRules.map((rule) => [rule.id, rule]));
    const occurrencePeriods =
      query.payables && !query.dateStart && !query.dateEnd
        ? Array.from({ length: 27 }, (_, index) => addMonthsToPeriod(period, index - 13))
        : query.dateStart || query.dateEnd
          ? listPeriodsBetween(
              accountStatement
                ? getEarlierPeriod(getPeriodFromDate(periodStart))
                : getPeriodFromDate(periodStart),
              addMonthsToPeriod(getPeriodFromDate(periodEnd), 1),
            )
          : [
              getEarlierPeriod(period),
              getPreviousPeriod(period),
              period,
              addMonthsToPeriod(period, 1),
            ];
    const scheduledOccurrences = scheduledRecurringRules.flatMap((rule) => {
      const occurrenceDates = occurrencePeriods.flatMap((occurrencePeriod) =>
        listRecurrenceDatesInPeriod({
          anchorDate: toDateString(rule.anchorDate),
          startDate: toDateString(rule.startDate),
          endDate: rule.endDate ? toDateString(rule.endDate) : null,
          frequency: rule.frequency,
          recurrenceEndDate: rule.recurrenceEndDate ? toDateString(rule.recurrenceEndDate) : null,
          dueDate: rule.dueDate ? toDateString(rule.dueDate) : null,
          period: occurrencePeriod,
        }),
      );

      return occurrenceDates
        .map((purchaseDate) => {
          const dueDate = getRecurringDueDate(
            rule.dueDate ? toDateString(rule.dueDate) : null,
            purchaseDate,
          );
          const occurrencePeriod = deriveTransactionPeriod({
            paymentMethod: rule.paymentMethod,
            purchaseDate,
            dueDate,
            card:
              rule.cardClosingRuleType && rule.cardDueDay
                ? {
                    closingDay: rule.cardClosingDay,
                    closingRule: resolveCardClosingRule({
                      closingRuleType: rule.cardClosingRuleType,
                      closingDay: rule.cardClosingDay,
                      closingOffsetDays: rule.cardClosingOffsetDays,
                      closingOffsetMode: rule.cardClosingOffsetMode,
                      closingDayPurchasesNextInvoice:
                        rule.cardClosingDayPurchasesNextInvoice ?? false,
                    }),
                    dueDay: Number(rule.cardDueDay),
                  }
                : null,
          });

          const isInDateRange =
            purchaseDate >= toDateString(periodStart) && purchaseDate <= toDateString(periodEnd);

          return (
            query.dateStart || query.dateEnd
              ? accountStatement || isInDateRange
              : query.payables || occurrencePeriod === period
          )
            ? toRecurringOccurrenceOutput(rule, purchaseDate, occurrencePeriod, dueDate)
            : null;
        })
        .filter((transaction): transaction is TransactionOutput => Boolean(transaction));
    });
    const paidBoletoOutputs = paidBoletoOccurrences.flatMap((occurrence) => {
      const rule = rulesById.get(occurrence.recurringRuleId);
      if (rule?.status !== "active") return [];
      const purchaseDate = toDateString(occurrence.purchaseDate);
      const dueDate = getRecurringDueDate(
        rule.dueDate ? toDateString(rule.dueDate) : null,
        purchaseDate,
      );
      return [
        toRecurringOccurrenceOutput(
          rule,
          purchaseDate,
          deriveTransactionPeriod({ paymentMethod: rule.paymentMethod, purchaseDate, dueDate }),
          dueDate,
        ),
      ];
    });
    const seriesByRuleId = new Map(recurringRules.map((rule) => [rule.id, rule.seriesId]));
    const recurringOccurrences = accountStatement
      ? [
          ...new Map(
            [...scheduledOccurrences, ...paidBoletoOutputs].map((item) => [
              `${seriesByRuleId.get(item.recurringRuleId ?? "")}:${item.purchaseDate}`,
              item,
            ]),
          ).values(),
        ]
      : scheduledOccurrences;
    const transactionSplits = await listTransactionSplitsForUser(
      transactions.map((transaction) => transaction.id),
      userId,
    );
    const ruleIds = recurringRules.map((rule) => rule.id);
    const seriesIds = [...new Set(recurringRules.map((rule) => rule.seriesId))];
    const [recurringSplits, recurringOccurrenceStates] = await Promise.all([
      listRecurringSplitsForUser(ruleIds, userId),
      listRecurringOccurrencesForUser(
        seriesIds,
        accountStatement
          ? getPeriodStart(getEarlierPeriod(getPeriodFromDate(periodStart)))
          : query.dateStart || query.dateEnd
            ? periodStart
            : getPeriodStart(
                query.payables ? addMonthsToPeriod(period, -13) : getEarlierPeriod(period),
              ),
        query.payables ? getPeriodEndDate(addMonthsToPeriod(period, 13)) : periodEnd,
        userId,
      ),
    ]);
    const occurrenceStates = new Map(
      [...recurringOccurrenceStates, ...paidBoletoOccurrences].map((occurrence) => [
        `${occurrence.recurringSeriesId}:${toDateString(occurrence.purchaseDate)}`,
        occurrence,
      ]),
    );
    const transactionSplitsById = new Map<string, typeof transactionSplits>();
    for (const split of transactionSplits) {
      transactionSplitsById.set(split.transactionId, [
        ...(transactionSplitsById.get(split.transactionId) ?? []),
        split,
      ]);
    }
    const recurringSplitsByRuleId = new Map<string, typeof recurringSplits>();
    for (const split of recurringSplits) {
      recurringSplitsByRuleId.set(split.recurringRuleId, [
        ...(recurringSplitsByRuleId.get(split.recurringRuleId) ?? []),
        split,
      ]);
    }
    const attachedTransactions = new Set(
      (
        await listTransactionIdsWithAttachmentsForUser(
          transactions.map((transaction) => transaction.id),
          userId,
        )
      ).map((item) => item.transactionId),
    );
    const hydratedTransactions = [
      ...transactions.map(toTransactionOutput),
      ...recurringOccurrences,
    ].map((item) => {
      const occurrence =
        item.isRecurring && item.recurringRuleId
          ? occurrenceStates.get(`${seriesByRuleId.get(item.recurringRuleId)}:${item.purchaseDate}`)
          : undefined;
      const isSettled = occurrence?.isSettled ?? item.isSettled;
      const boletoPaymentDate = occurrence?.boletoPaymentDate
        ? toDateString(occurrence.boletoPaymentDate)
        : item.boletoPaymentDate;
      const splits = item.recurringRuleId
        ? (recurringSplitsByRuleId.get(item.recurringRuleId) ?? [])
        : (transactionSplitsById.get(item.recordId ?? "") ?? []);
      return {
        ...item,
        isSettled,
        accountId: occurrence?.accountId ?? item.accountId,
        accountName: occurrence?.accountName ?? item.accountName,
        accountLogo: occurrence?.accountLogo ?? item.accountLogo,
        boletoPaymentDate,
        settledDate: occurrence?.settledDate
          ? toDateString(occurrence.settledDate)
          : item.settledDate,
        postingDate: item.isRecurring
          ? deriveTransactionPostingDate({
              paymentMethod: item.paymentMethod,
              purchaseDate: item.purchaseDate,
              dueDate: item.dueDate,
              boletoPaymentDate,
              settledDate: occurrence?.settledDate
                ? toDateString(occurrence.settledDate)
                : item.settledDate,
              isSettled,
            })
          : item.postingDate,
        splitShares: splits.map((split) => ({
          personId: split.personId,
          personName: split.personName,
          personAvatarUrl: split.personAvatarUrl,
          plannedAmount: Math.abs(
            Number("plannedAmount" in split ? split.plannedAmount : split.amount),
          ),
          amount: Math.abs(
            Number(
              occurrence?.isSettled
                ? (occurrence.settledAllocations?.find((share) => share.personId === split.personId)
                    ?.amount ?? split.amount)
                : split.amount,
            ),
          ),
        })),
        isDivided: splits.length > 0,
        hasAttachments: item.recordId ? attachedTransactions.has(item.recordId) : false,
      };
    });
    const presentedTransactions = hydratedTransactions.map((item) => {
      const occurrence = item.recurringRuleId
        ? occurrenceStates.get(`${seriesByRuleId.get(item.recurringRuleId)}:${item.purchaseDate}`)
        : undefined;
      const persisted = item.recordId
        ? transactions.find((row) => row.id === item.recordId)
        : undefined;
      return {
        ...item,
        dueDateRuleExcluded: occurrence?.dueDateRuleExcluded ?? item.dueDateRuleExcluded,
        ...resolveDueDate(
          {
            dueDate: item.originalDueDate ?? item.dueDate,
            type: item.type,
            origin: item.origin,
            paymentMethod: item.paymentMethod,
            transactionId: item.recordId,
            seriesId: item.recurringRuleId ? seriesByRuleId.get(item.recurringRuleId) : null,
            isSettled: item.isSettled,
            excluded: occurrence?.dueDateRuleExcluded ?? item.dueDateRuleExcluded,
            frozenAdjustment: occurrence?.dueDateAdjustment ?? persisted?.dueDateAdjustment,
            frozenDueDate: occurrence?.frozenDueDate
              ? toDateString(occurrence.frozenDueDate)
              : persisted?.frozenDueDate
                ? toDateString(persisted.frozenDueDate)
                : null,
          },
          dueDateVersions,
        ),
      };
    });
    const output = presentedTransactions.flatMap((item) =>
      projectTransactionAllocations({
        id: item.id,
        amount: item.amount,
        splitShares: item.splitShares,
      }).map((projection) => ({
        ...item,
        ...projection,
      })),
    );

    const filtered = output
      .filter((item) => {
        if (!matchesTransactionFilters(item, query)) return false;
        if (
          query.payables &&
          !query.dateStart &&
          !query.dateEnd &&
          item.dueDate?.slice(0, 7) !== period
        )
          return false;
        if (!accountStatement) return true;
        if (item.isSettled !== true) return false;
        if (query.dateStart || query.dateEnd) {
          return (
            item.postingDate !== null &&
            item.postingDate >= toDateString(periodStart) &&
            item.postingDate <= toDateString(periodEnd)
          );
        }
        return (
          deriveTransactionPostingPeriod({
            period: item.period,
            paymentMethod: item.paymentMethod,
            boletoPaymentDate: item.boletoPaymentDate,
            settledDate: item.settledDate,
          }) === period
        );
      })
      .sort(
        (a, b) =>
          (query.sort === "oldest"
            ? (accountStatement ? (a.postingDate ?? a.purchaseDate) : a.purchaseDate).localeCompare(
                accountStatement ? (b.postingDate ?? b.purchaseDate) : b.purchaseDate,
              )
            : query.sort === "dueDate"
              ? (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31")
              : query.sort === "amount"
                ? Math.abs(b.amount) - Math.abs(a.amount)
                : (accountStatement
                    ? (b.postingDate ?? b.purchaseDate)
                    : b.purchaseDate
                  ).localeCompare(
                    accountStatement ? (a.postingDate ?? a.purchaseDate) : a.purchaseDate,
                  )) ||
          a.name.localeCompare(b.name) ||
          (a.allocation?.personName ?? a.personName).localeCompare(
            b.allocation?.personName ?? b.personName,
          ) ||
          a.id.localeCompare(b.id),
      );
    // Paginate purchases/occurrences, keeping every matching allocation together.
    const groups = new Map<string, TransactionOutput[]>();
    for (const item of filtered) {
      const key =
        item.recordId ??
        (item.recurringRuleId ? `${item.recurringRuleId}:${item.purchaseDate}` : item.id);
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    const start = (query.page - 1) * query.pageSize;

    return {
      items: (paginate
        ? [...groups.values()].slice(start, start + query.pageSize)
        : [...groups.values()]
      ).flat(),
      total: groups.size,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async function exportTransactions(userId: string, query: ExportTransactionsQuery) {
    const period = query.period ?? currentPeriod();
    const result = await listTransactions(userId, { ...query, period }, false);
    return createTransactionsExport(result.items, { ...query, period });
  }

  function listPeriodsBetween(startPeriod: string, endPeriod: string) {
    const periods: string[] = [];
    for (let period = startPeriod; period <= endPeriod; period = addMonthsToPeriod(period, 1)) {
      periods.push(period);
    }
    return periods;
  }

  function matchesTransactionFilters(item: TransactionOutput, query: ListTransactionsQuery) {
    if (query.payables && !isPayable(item)) return false;
    const normalizedSearch = query.q?.toLocaleLowerCase("pt-BR");
    const matchesSearch =
      !normalizedSearch ||
      [
        item.name,
        item.note,
        item.allocation?.personName ?? item.personName,
        item.categoryName,
        item.accountName,
        item.cardName,
        item.paymentMethod,
        item.condition,
        item.paymentMethod
          ? {
              credit_card: "cartão de crédito",
              debit_card: "cartão de débito",
              pix: "Pix",
              cash: "dinheiro",
              boleto: "boleto",
              benefits: "benefício vale",
              bank_transfer: "transferência bancária",
            }[item.paymentMethod]
          : null,
        {
          single: "única à vista",
          installment: "parcelada parcelas",
          recurring: "recorrente recorrência",
        }[item.condition],
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    const accountIds = (
      item.type === "transfer" && item.accountId
        ? [item.accountId]
        : [item.accountId, item.sourceAccountId, item.destinationAccountId]
    ).filter((id): id is string => Boolean(id));

    return (
      matchesSearch &&
      matchesTransactionTags(item.tagIds ?? [], query.tagIds ?? [], query.withoutTags) &&
      (!query.type || item.type === query.type) &&
      (!query.condition || item.condition === query.condition) &&
      (!query.paymentMethod || item.paymentMethod === query.paymentMethod) &&
      (!query.settlement ||
        (query.settlement === "invoice"
          ? item.isSettled === null
          : query.settlement === "paid"
            ? item.isSettled === true
            : item.isSettled === false)) &&
      (!query.personIds.length ||
        query.personIds.includes(item.allocation?.personId ?? item.personId)) &&
      (!query.categoryIds.length ||
        (item.categoryId !== null && query.categoryIds.includes(item.categoryId))) &&
      (!query.accountIds.length || accountIds.some((id) => query.accountIds.includes(id))) &&
      (!query.cardIds.length || (item.cardId !== null && query.cardIds.includes(item.cardId))) &&
      (query.minAmount === undefined ||
        Math.abs(item.allocation?.amount ?? item.amount) >= query.minAmount) &&
      (query.maxAmount === undefined ||
        Math.abs(item.allocation?.amount ?? item.amount) <= query.maxAmount) &&
      (!query.hasAttachments || item.hasAttachments) &&
      (!query.isDivided || item.isDivided)
    );
  }

  async function getRecurringRuleOccurrence(id: string, purchaseDate: string, userId: string) {
    const rule = await findRecurringRuleByIdForUser(id, userId);
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    if (
      !isActiveRecurringOccurrence(
        {
          ...rule,
          dueDate: rule.dueDate ? toDateString(rule.dueDate) : null,
          startDate: toDateString(rule.startDate),
          endDate: rule.endDate ? toDateString(rule.endDate) : null,
          anchorDate: toDateString(rule.anchorDate),

          recurrenceEndDate: rule.recurrenceEndDate ? toDateString(rule.recurrenceEndDate) : null,
        },
        purchaseDate,
      )
    )
      throw badRequest("Invalid recurring occurrence", "INVALID_RECURRING_OCCURRENCE");
    const dueDate = getRecurringDueDate(
      rule.dueDate ? toDateString(rule.dueDate) : null,
      purchaseDate,
    );
    const occurrencePeriod = deriveTransactionPeriod({
      paymentMethod: rule.paymentMethod,
      purchaseDate,
      dueDate,
      card:
        rule.cardClosingRuleType && rule.cardDueDay
          ? {
              closingDay: rule.cardClosingDay,
              closingRule: resolveCardClosingRule({
                closingRuleType: rule.cardClosingRuleType,
                closingDay: rule.cardClosingDay,
                closingOffsetDays: rule.cardClosingOffsetDays,
                closingOffsetMode: rule.cardClosingOffsetMode,
                closingDayPurchasesNextInvoice: rule.cardClosingDayPurchasesNextInvoice ?? false,
              }),
              dueDay: Number(rule.cardDueDay),
            }
          : null,
    });
    const [splits, states] = await Promise.all([
      listRecurringSplitsForUser([id], userId),
      listRecurringOccurrencesForUser(
        [rule.seriesId],
        toDate(purchaseDate),
        toDate(purchaseDate),
        userId,
      ),
    ]);
    return presentTransaction(
      {
        ...toRecurringOccurrenceOutput(rule, purchaseDate, occurrencePeriod, dueDate),
        isSettled: states[0]?.isSettled ?? rule.isSettled ?? false,
        dueDateRuleExcluded: states[0]?.dueDateRuleExcluded ?? rule.dueDateRuleExcluded ?? false,
        splitShares: splits.map((share) => ({
          personId: share.personId,
          personName: share.personName,
          personAvatarUrl: share.personAvatarUrl,
          amount: Math.abs(getOccurrenceAmount(rule, purchaseDate, share.amount, share.personId)),
          plannedAmount: Math.abs(Number(share.amount)),
        })),
        isDivided: splits.length > 0,
      },
      userId,
      rule.seriesId,
      states[0]?.frozenDueDate ? toDateString(states[0].frozenDueDate) : null,
      states[0]?.dueDateAdjustment,
    );
  }

  async function getTransactionById(id: string, userId: string) {
    const transaction = await findTransactionByIdForUser(id, userId);

    if (!transaction) {
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    const [splits, attached] = await Promise.all([
      listTransactionSplitsForUser([id], userId),
      listTransactionIdsWithAttachmentsForUser([id], userId),
    ]);
    const output = await presentTransaction(
      toTransactionOutput(transaction),
      userId,
      undefined,
      transaction.frozenDueDate ? toDateString(transaction.frozenDueDate) : null,
    );

    return {
      ...output,
      splitShares: splits.map((split) => ({
        personId: split.personId,
        personName: split.personName,
        personAvatarUrl: split.personAvatarUrl,
        amount: Math.abs(Number(split.amount)),
        plannedAmount: Math.abs(Number(split.plannedAmount ?? split.amount)),
      })),
      isDivided: splits.length > 0,
      hasAttachments: attached.length > 0,
    };
  }

  async function createTransactionRefund(
    id: string,
    input: CreateTransactionRefundInput,
    userId: string,
  ): Promise<TransactionRefundOutput> {
    const source = await findTransactionByIdForUser(id, userId);
    if (!source) throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    if (source.type !== "expense" || source.origin !== "regular" || source.paymentMethod === null) {
      throw badRequest("Transaction cannot be refunded", "TRANSACTION_NOT_REFUNDABLE");
    }
    if (input.receivedAt > getCurrentDateInBrazil()) {
      throw badRequest("Refund date cannot be in the future", "REFUND_DATE_FUTURE");
    }
    if (source.cardId && !input.invoicePeriod) {
      throw badRequest("Credit card refunds require an invoice period", "REFUND_INVOICE_REQUIRED");
    }
    if (!source.cardId && input.invoicePeriod) {
      throw badRequest(
        "Account refunds cannot use an invoice period",
        "REFUND_INVOICE_NOT_ALLOWED",
      );
    }

    let calculation: ReturnType<typeof calculateRefund>;
    try {
      calculation = calculateRefund({
        originalAmount: source.amount,
        previousRefunds: [source.refundedAmount],
        refundAmount: input.amount,
      });
    } catch {
      throw badRequest("Refund exceeds the available amount", "INVALID_REFUND_AMOUNT");
    }

    const period = source.cardId
      ? (input.invoicePeriod as string)
      : getPeriodFromDate(input.receivedAt);
    if (source.cardId) {
      const paidPeriods = await listPaidInvoicePeriodsForUser(source.cardId, [period], userId);
      if (paidPeriods.length) {
        throw badRequest("Paid invoices cannot receive refunds", "INVOICE_ALREADY_PAID");
      }
    }
    const sourceSplits = await listTransactionSplitsForUser([source.id], userId);
    const allocations = allocateRefundByResponsibility(
      calculation.refundAmount,
      source.personId,
      sourceSplits.map((split) => ({ personId: split.personId, amount: split.amount })),
    );
    const refund = await insertTransactionRefundForUser({
      userId,
      sourceTransactionId: source.id,
      amount: calculation.refundAmount,
      splits: allocations,
      record: {
        userId,
        personId: source.personId,
        type: "income",
        origin: "refund",
        condition: "single",
        paymentMethod: source.paymentMethod,
        name: `Reembolso · ${source.name}`,
        amount: calculation.refundAmount.toFixed(2),
        purchaseDate: toDate(input.receivedAt),
        period,
        accountId: source.accountId,
        cardId: source.cardId,
        categoryId: source.categoryId,
        tagIds: source.tagIds,
        sourceAccountId: null,
        destinationAccountId: null,
        dueDate: null,
        boletoPaymentDate: null,
        installmentCount: null,
        currentInstallment: null,
        seriesId: null,
        transferId: null,
        recurringRuleId: null,
        isSettled: source.cardId ? null : true,
        note: normalizeNullableText(input.note) ?? `Reembolso de “${source.name}”.`,
        importSourceFingerprint: null,
        importExternalId: null,
        importBatchId: null,
      },
    });
    if (!refund) {
      throw conflict("Transaction changed while refunding", "TRANSACTION_REFUND_CONFLICT");
    }

    return {
      id: refund.id,
      sourceTransactionId: source.id,
      amount: calculation.refundAmount,
      remainingRefundableAmount: calculation.remainingRefundableAmount,
    };
  }

  async function updateTransaction(
    id: string,
    userId: string,
    data: UpdateTransactionInput,
    scope: TransactionActionScope = "single",
  ) {
    const current = await findTransactionByIdForUser(id, userId);

    if (!current) {
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }
    if (current.paymentMethod === null) {
      throw badRequest(
        "Balance adjustments must be managed through the account balance action",
        "BALANCE_ADJUSTMENT_IMMUTABLE",
      );
    }
    if (current.origin !== "regular") {
      throw badRequest(
        "Generated transactions cannot be edited",
        "GENERATED_TRANSACTION_IMMUTABLE",
      );
    }

    if (
      current.settledDate &&
      ((data.isSettled !== undefined && data.isSettled !== current.isSettled) ||
        [
          "amount",
          "type",
          "paymentMethod",
          "purchaseDate",
          "personId",
          "accountId",
          "cardId",
          "splitShares",
          "settledDate",
          "boletoPaymentDate",
          "dueDate",
          "condition",
          "invoicePeriod",
        ].some((key) => key in data))
    )
      throw badRequest(
        "Undo settlement before changing financial fields",
        "SETTLEMENT_REQUIRES_UNDO",
      );
    if (
      current.type !== "transfer" &&
      data.isSettled !== undefined &&
      data.isSettled !== current.isSettled
    )
      throw badRequest("Use settlement action to change payment status", "SETTLEMENT_USE_ACTION");
    const currentSplits = await listTransactionSplitsForUser([id], userId);

    if (
      current.condition === "installment" &&
      data.installmentCount !== undefined &&
      data.installmentCount !== current.installmentCount
    ) {
      throw badRequest(
        "Installment count cannot be changed after creation",
        "INSTALLMENT_COUNT_IMMUTABLE",
      );
    }

    const merged: TransactionInput = {
      type: data.type ?? current.type,
      condition: data.condition ?? current.condition,
      paymentMethod: data.paymentMethod ?? current.paymentMethod,
      name: data.name ?? current.name,
      amount: data.amount ?? toDisplayAmount(current.plannedAmount ?? current.amount),
      purchaseDate: data.purchaseDate ?? toDateString(current.purchaseDate),
      invoicePeriod:
        (data.condition ?? current.condition) === "recurring"
          ? null
          : data.invoicePeriod === undefined && current.paymentMethod === "credit_card"
            ? current.period
            : data.invoicePeriod,
      personId: data.personId ?? current.personId,
      accountId: data.accountId === undefined ? current.accountId : data.accountId,
      cardId: data.cardId === undefined ? current.cardId : data.cardId,
      categoryId: data.categoryId === undefined ? current.categoryId : data.categoryId,
      sourceAccountId:
        data.sourceAccountId === undefined ? current.sourceAccountId : data.sourceAccountId,
      destinationAccountId:
        data.destinationAccountId === undefined
          ? current.destinationAccountId
          : data.destinationAccountId,
      dueDateRuleExcluded: data.dueDateRuleExcluded ?? current.dueDateRuleExcluded,
      dueDate:
        data.dueDate === undefined
          ? current.dueDate
            ? toDateString(current.dueDate)
            : null
          : data.dueDate,
      settledDate:
        data.settledDate === undefined
          ? current.settledDate
            ? toDateString(current.settledDate)
            : null
          : data.settledDate,
      boletoPaymentDate:
        data.boletoPaymentDate === undefined
          ? current.boletoPaymentDate
            ? toDateString(current.boletoPaymentDate)
            : null
          : data.boletoPaymentDate,
      installmentCount: data.installmentCount ?? current.installmentCount,
      recurrenceFrequency: data.recurrenceFrequency,
      isSettled: data.isSettled === undefined ? current.isSettled : data.isSettled,
      note: data.note === undefined ? current.note : data.note,
      tagIds: data.tagIds ?? current.tagIds,
      splitShares:
        data.splitShares === undefined
          ? currentSplits.length
            ? currentSplits.map((split) => ({
                personId: split.personId,
                amount: Math.abs(Number(split.plannedAmount ?? split.amount)),
              }))
            : null
          : data.splitShares,
    };
    const validatedMerged = TransactionInputSchema.parse(merged);
    assertBoletoPaymentDateIsNotFuture(validatedMerged);
    if (
      validatedMerged.condition !== current.condition ||
      validatedMerged.type !== current.type ||
      (validatedMerged.type === "transfer" && !current.transferId)
    ) {
      const converted = await createTransaction({ ...validatedMerged, userId });
      if (converted.recordId)
        await copyTransactionAttachmentLinksForUser(id, converted.recordId, userId);
      if (current.transferId) {
        await deleteTransferPairForUser(current.transferId, userId);
      } else {
        await deleteTransactionForUser(id, userId);
      }
      await cleanupOrphanedAttachments(userId);
      return converted;
    }
    const context = await assertOwnership(validatedMerged, userId);
    // Creation initializes the pair identity; edits must preserve the existing link.
    const { transferId: _transferId, ...base } = buildBaseRecord(
      { ...validatedMerged, userId },
      context,
    );
    const values: TransactionUpdateRecord = {
      ...base,
      settledDate: current.settledDate ?? null,
      tagIds: data.tagIds,
      amount: normalizeTransactionAmount(validatedMerged.type, validatedMerged.amount).toFixed(2),
      purchaseDate: toDate(validatedMerged.purchaseDate),
      period: resolveEditedTransactionPeriod({
        current: {
          condition: current.condition,
          paymentMethod: current.paymentMethod,
          period: current.period,
          purchaseDate: toDateString(current.purchaseDate),
          dueDate: current.dueDate ? toDateString(current.dueDate) : null,
          cardId: current.cardId,
        },
        updated: validatedMerged,
        invoicePeriod: data.invoicePeriod,
        derivedPeriod: derivePeriod(validatedMerged, context, validatedMerged.purchaseDate),
      }),
      installmentCount:
        validatedMerged.condition === "installment"
          ? (validatedMerged.installmentCount as number)
          : null,
      currentInstallment:
        validatedMerged.condition === "installment" ? (current.currentInstallment ?? 1) : null,
    };
    if (scope !== "single") {
      if (
        current.condition !== "installment" ||
        !current.seriesId ||
        current.currentInstallment === null
      ) {
        throw badRequest("Scope is only available for installment series", "INVALID_SERIES_SCOPE");
      }
      if (
        validatedMerged.type !== current.type ||
        validatedMerged.condition !== current.condition ||
        validatedMerged.paymentMethod !== current.paymentMethod ||
        validatedMerged.installmentCount !== current.installmentCount
      ) {
        throw badRequest(
          "Installment structure cannot be changed across a series",
          "INSTALLMENT_STRUCTURE_IMMUTABLE",
        );
      }

      const anchorInstallment = current.currentInstallment;
      const series = await listTransactionSeriesForUser(current.seriesId, userId);
      const targets = series.filter(
        (transaction) =>
          transaction.currentInstallment !== null &&
          (scope === "series" || transaction.currentInstallment >= anchorInstallment),
      );
      if (
        targets.some((target) => target.settledDate) &&
        [
          "amount",
          "purchaseDate",
          "dueDate",
          "accountId",
          "personId",
          "splitShares",
          "isSettled",
          "settledDate",
          "boletoPaymentDate",
        ].some((key) => key in data)
      )
        throw badRequest("Undo settlement before editing this series", "SETTLEMENT_REQUIRES_UNDO");
      const anchorPeriod = derivePeriod(validatedMerged, context, validatedMerged.purchaseDate);
      const rebuildPurchaseDates = data.purchaseDate !== undefined;
      const rebuildDueDates = data.dueDate !== undefined;
      const rebuildBoletoPaymentDates = data.boletoPaymentDate !== undefined;
      const rebuildPeriods =
        rebuildPurchaseDates ||
        rebuildDueDates ||
        data.invoicePeriod !== undefined ||
        data.cardId !== undefined;
      const splitShares =
        data.splitShares === undefined ? undefined : (validatedMerged.splitShares ?? []);
      const updated = await translateTransferBalanceError(() =>
        updateTransactionSeriesRangeWithSplitsForUser(
          userId,
          targets.map((target) => {
            const offset = (target.currentInstallment as number) - anchorInstallment;
            const targetAmount =
              data.amount === undefined
                ? toDisplayAmount(target.plannedAmount ?? target.amount)
                : validatedMerged.amount;
            const targetSplitAmounts = splitShares?.length
              ? allocateAmountProportionally(
                  targetAmount,
                  splitShares.map((share) => share.amount),
                )
              : [];
            return {
              id: target.id,
              data: {
                ...values,
                amount:
                  data.amount === undefined
                    ? (target.plannedAmount ?? target.amount)
                    : normalizeTransactionAmount(
                        validatedMerged.type,
                        validatedMerged.amount,
                      ).toFixed(2),
                purchaseDate: rebuildPurchaseDates
                  ? toDate(addMonthsToDate(validatedMerged.purchaseDate, offset))
                  : target.purchaseDate,
                period: rebuildPeriods ? addMonthsToPeriod(anchorPeriod, offset) : target.period,
                dueDate: rebuildDueDates
                  ? validatedMerged.dueDate
                    ? toDate(addMonthsToDate(validatedMerged.dueDate, offset))
                    : null
                  : target.dueDate,
                boletoPaymentDate: rebuildBoletoPaymentDates
                  ? validatedMerged.boletoPaymentDate
                    ? toDate(addMonthsToDate(validatedMerged.boletoPaymentDate, offset))
                    : null
                  : target.boletoPaymentDate,
                currentInstallment: target.currentInstallment,
                isSettled: data.isSettled === undefined ? target.isSettled : values.isSettled,
                settledDate: target.settledDate ?? null,
              },
              splits:
                splitShares === undefined
                  ? undefined
                  : splitShares.map((share, index) => ({
                      personId: share.personId,
                      amount: normalizeTransactionAmount(
                        validatedMerged.type,
                        targetSplitAmounts[index] as number,
                      ).toFixed(2),
                    })),
            };
          }),
        ),
      );
      if (!updated.includes(id)) {
        throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
      }
      return getTransactionById(id, userId);
    }
    if (validatedMerged.type === "transfer" && current.transferId) {
      const [outgoing, incoming] = buildTransferPostings({
        sourceAccountId: validatedMerged.sourceAccountId as string,
        destinationAccountId: validatedMerged.destinationAccountId as string,
        amount: validatedMerged.amount,
      });
      const balancePeriod = currentPeriod();
      const balanceSnapshot = values.isSettled
        ? await getAccountBalanceSnapshotForUser(outgoing.accountId, userId, balancePeriod)
        : { displayed: 0, persisted: 0 };
      const transaction = await translateTransferBalanceError(() =>
        updateTransferPairForUser(
          current.transferId as string,
          userId,
          { ...values, accountId: outgoing.accountId, amount: outgoing.amount.toFixed(2) },
          { ...values, accountId: incoming.accountId, amount: incoming.amount.toFixed(2) },
          balancePeriod,
          balanceSnapshot,
        ),
      );
      if (!transaction) {
        throw notFound("Transfer transaction not found", "TRANSFER_TRANSACTION_NOT_FOUND");
      }
      return getTransactionById(transaction.id, userId);
    }
    const transaction = await translateTransferBalanceError(() =>
      updateTransactionWithSplitsForUser(
        id,
        userId,
        values,
        data.splitShares === undefined
          ? undefined
          : (validatedMerged.splitShares ?? []).map((share) => ({
              personId: share.personId,
              amount: normalizeTransactionAmount(validatedMerged.type, share.amount).toFixed(2),
            })),
      ),
    );

    if (!transaction) {
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    return getTransactionById(transaction.id, userId);
  }

  async function deleteTransaction(
    id: string,
    userId: string,
    scope: TransactionActionScope = "single",
  ) {
    const current = await findTransactionByIdForUser(id, userId);
    if (!current) throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    if (!canDeleteTransactionOrigin(current.origin)) {
      throw badRequest(
        "Generated transaction must be removed through its owning workflow",
        "GENERATED_TRANSACTION_IMMUTABLE",
      );
    }
    if (Number(current.refundedAmount) > 0) {
      throw badRequest(
        "Refunded transactions cannot be removed before their refunds",
        "TRANSACTION_HAS_REFUNDS",
      );
    }
    if (scope === "series" && current.seriesId) {
      const deleted = await deleteTransactionSeriesForUser(current.seriesId, userId);
      await cleanupOrphanedAttachments(userId);
      return { id, affected: deleted.length };
    }
    if (scope === "future" && current.seriesId && current.currentInstallment !== null) {
      const deleted = await deleteTransactionSeriesRangeForUser(
        current.seriesId,
        current.currentInstallment,
        userId,
      );
      await cleanupOrphanedAttachments(userId);
      return { id, affected: deleted.length };
    }
    if (current.transferId) {
      const deleted = await deleteTransferPairForUser(current.transferId, userId);
      if (!deleted.length) {
        throw notFound("Transfer transaction not found", "TRANSFER_TRANSACTION_NOT_FOUND");
      }
      await cleanupOrphanedAttachments(userId);
      return { id, affected: deleted.length };
    }
    const deletedTransaction = await deleteTransactionForUser(id, userId);

    if (!deletedTransaction) {
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    await cleanupOrphanedAttachments(userId);

    return { id, affected: 1 };
  }

  async function cleanupOrphanedAttachments(userId: string) {
    try {
      await attachmentCleaner.cleanupOrphans(userId);
    } catch (error) {
      console.error("Failed to clean orphaned attachments after transaction deletion", error);
    }
  }

  async function listBulkTargets(ids: string[], userId: string) {
    const uniqueIds = [...new Set(ids)];
    const targets = await listBulkTransactionTargetsForUser(uniqueIds, userId);
    if (targets.length !== uniqueIds.length)
      throw notFound("One or more transactions were not found", "TRANSACTION_NOT_FOUND");
    return targets.map((target) => ({ ...target, refundedAmount: Number(target.refundedAmount) }));
  }

  async function categorizeTransactions(input: BulkCategorizeTransactionsInput, userId: string) {
    const [category] = await listCategoriesByIdsForUser([input.categoryId], userId);
    if (!category) throw notFound("Category not found", "CATEGORY_NOT_FOUND");
    const targets = await listBulkTargets(input.ids, userId);
    if (!targets.every((target) => canAssignBulkCategory(target, category)))
      throw badRequest(
        "Category is not compatible with every transaction",
        "BULK_CATEGORY_INCOMPATIBLE",
      );
    return {
      ids: await updateTransactionsCategoryForUser(
        targets.map((target) => target.id),
        userId,
        category.id,
      ),
    };
  }

  async function renameTransactions(input: BulkRenameTransactionsInput, userId: string) {
    const targets = await listBulkTargets(
      input.items.map((item) => item.id),
      userId,
    );
    if (!targets.every((target) => canApplyBulkTransactionAction(target, "rename")))
      throw badRequest("Bulk action is not supported", "BULK_ACTION_UNSUPPORTED");
    return { ids: await renameTransactionsForUser(input.items, userId) };
  }

  async function tagTransactions(input: BulkTagTransactionsInput, userId: string) {
    const ownedTags = await dependencies.listTagsByIdsForUser?.(input.tagIds, userId);
    if (!ownedTags || ownedTags.length !== input.tagIds.length)
      throw notFound("Tag not found", "tag_not_found");
    const targets = await listBulkTargets(input.ids, userId);
    if (!targets.every((target) => canApplyBulkTransactionAction(target, "tag")))
      throw badRequest("Bulk action is not supported", "BULK_ACTION_UNSUPPORTED");
    const ids = targets.map((target) => target.id);
    if (input.operation === "remove")
      return { ids: await removeTransactionsTagsForUser(ids, userId, input.tagIds) };
    if (!targets.every((target) => canAddTransactionTags(target.tagIds, input.tagIds)))
      throw badRequest("Transaction tag limit exceeded", "TAG_LIMIT_EXCEEDED");
    return { ids: await addTransactionsTagsForUser(ids, userId, input.tagIds) };
  }

  async function deleteTransactions(input: BulkDeleteTransactionsInput, userId: string) {
    const targets = await listBulkTargets(input.ids, userId);
    if (!targets.every((target) => canApplyBulkTransactionAction(target, "delete")))
      throw badRequest("Bulk action is not supported", "BULK_ACTION_UNSUPPORTED");
    const ids = await deleteTransactionsForUser(
      targets.map((target) => target.id),
      userId,
    );
    await cleanupOrphanedAttachments(userId);
    return { ids };
  }

  async function settleTransactions(
    ids: string[],
    userId: string,
    isSettled: boolean,
    settledDate?: string,
    settledAmount?: number,
    settlementAccountId?: string,
  ) {
    if (settlementAccountId) {
      const account = await findAccountByIdForUser(settlementAccountId, userId);
      if (!account || account.isArchived) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    }
    if (settledDate && settledDate > getCurrentDateInBrazil())
      throw badRequest("Settlement date cannot be in the future", "SETTLEMENT_DATE_FUTURE");
    const balancePeriod = currentPeriod();
    const balanceSnapshots = isSettled
      ? Object.fromEntries(
          await Promise.all(
            [
              ...new Set(
                (
                  await Promise.all(ids.map((id) => findTransactionByIdForUser(id, userId)))
                ).flatMap((transaction) =>
                  transaction?.type === "transfer" && transaction.sourceAccountId
                    ? [transaction.sourceAccountId]
                    : [],
                ),
              ),
            ].map(async (accountId) => [
              accountId,
              await getAccountBalanceSnapshotForUser(accountId, userId, balancePeriod),
            ]),
          ),
        )
      : {};
    const settled = await translateTransferBalanceError(() =>
      settleTransactionsForUser(
        ids,
        userId,
        isSettled,
        balancePeriod,
        balanceSnapshots,
        toDate(settledDate ?? getCurrentDateInBrazil()),
        settledAmount,
        settlementAccountId,
      ),
    );
    if (settled.length !== new Set(ids).size)
      throw notFound("One or more transactions were not found", "TRANSACTION_NOT_FOUND");
    return { ids: settled.map((item) => item.id), isSettled };
  }

  async function settleRecurringOccurrence(
    recurringRuleId: string,
    purchaseDate: string,
    userId: string,
    isSettled: boolean,
    settledDate?: string,
    settledAmount?: number,
    settlementAccountId?: string,
  ) {
    if (settlementAccountId) {
      const account = await findAccountByIdForUser(settlementAccountId, userId);
      if (!account || account.isArchived) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    }
    if (settledDate && settledDate > getCurrentDateInBrazil())
      throw badRequest("Settlement date cannot be in the future", "SETTLEMENT_DATE_FUTURE");
    const rule = await findRecurringRuleByIdForUser(recurringRuleId, userId);
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const validOccurrence = isActiveRecurringOccurrence(
      {
        id: rule.id,
        dueDate: rule.dueDate ? toDateString(rule.dueDate) : null,

        recurrenceEndDate: rule.recurrenceEndDate ? toDateString(rule.recurrenceEndDate) : null,
        status: rule.status,
        anchorDate: toDateString(rule.anchorDate),
        startDate: toDateString(rule.startDate),
        endDate: rule.endDate ? toDateString(rule.endDate) : null,
        frequency: rule.frequency,
      },
      purchaseDate,
    );
    if (!validOccurrence) {
      throw badRequest("Invalid recurring occurrence date", "INVALID_RECURRING_OCCURRENCE");
    }
    const occurrence = await translateTransferBalanceError(() =>
      settleRecurringOccurrenceForUser(
        recurringRuleId,
        toDate(purchaseDate),
        userId,
        isSettled,
        toDate(settledDate ?? getCurrentDateInBrazil()),
        settlementAccountId,
        settledAmount,
      ),
    );
    if (!occurrence) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    await synchronizeRecurringExternalExpensesFrom(userId, purchaseDate);
    return { recurringRuleId, purchaseDate, isSettled };
  }

  async function changeRecurringRuleStatus(
    id: string,
    userId: string,
    status: "active" | "paused" | "cancelled",
    occurrenceDate = getCurrentDateInBrazil(),
  ) {
    await applyRecurringRuleAction(id, userId, {
      action: status === "active" ? "resume" : status === "paused" ? "pause" : "stop",
      occurrenceDate,
    });
    return { id, status };
  }

  async function applyRecurringRuleAction(
    id: string,
    userId: string,
    input: RecurringOccurrenceActionInput,
  ) {
    const current = await findRecurringRuleByIdForUser(id, userId);
    if (!current) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    try {
      const updated = await dependencies.transitionRecurringRuleForUser(
        id,
        userId,
        input.action,
        input.occurrenceDate,
      );
      if (!updated) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    } catch (error) {
      if (error instanceof RecurringTransitionError)
        throw badRequest("Invalid recurring action or occurrence date", error.code);
      throw error;
    }
    await synchronizeRecurringExternalExpensesFrom(userId, input.occurrenceDate);
    return { id, ...input };
  }

  async function updateRecurringRule(
    id: string,
    userId: string,
    input: TransactionInput,
    query: UpdateRecurringRuleQuery = { scope: "series" },
  ) {
    const current = await findRecurringRuleByIdForUser(id, userId);
    if (!current) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const validated = TransactionInputSchema.parse({
      ...input,
      recurrenceEndDate:
        input.recurrenceEndDate === undefined
          ? current.recurrenceEndDate
            ? toDateString(current.recurrenceEndDate)
            : null
          : input.recurrenceEndDate,
      tagIds: input.tagIds ?? current.tagIds,
      dueDateRuleExcluded: input.dueDateRuleExcluded ?? current.dueDateRuleExcluded,
      condition: "recurring",
      recurrenceFrequency: input.recurrenceFrequency ?? current.frequency,
      invoicePeriod: null,
    });
    assertBoletoPaymentDateIsNotFuture(validated);
    const context = await assertOwnership(validated, userId);
    const base = buildBaseRecord({ ...validated, isSettled: current.isSettled, userId }, context);
    const currentAnchorDate = toDateString(current.anchorDate);
    const currentStartDate = toDateString(current.startDate);
    const selectedDate = query.occurrenceDate ?? validated.purchaseDate;
    const endDateChanged =
      input.recurrenceEndDate !== undefined &&
      input.recurrenceEndDate !==
        (current.recurrenceEndDate ? toDateString(current.recurrenceEndDate) : null);
    if (query.scope === "single" && endDateChanged)
      throw badRequest(
        "A recurrence deadline applies to future occurrences or the whole series",
        "RECURRING_END_DATE_SCOPE_UNSUPPORTED",
      );
    const validSelectedDate = listRecurrenceDatesInPeriod({
      anchorDate: currentAnchorDate,
      startDate: currentStartDate,
      endDate: current.endDate ? toDateString(current.endDate) : null,
      frequency: current.frequency,
      period: getPeriodFromDate(selectedDate),
    }).includes(selectedDate);
    if (query.scope !== "series" && !validSelectedDate) {
      throw badRequest("Invalid recurring occurrence date", "INVALID_RECURRING_OCCURRENCE");
    }
    const keepsCurrentSchedule =
      validated.recurrenceFrequency === current.frequency &&
      listRecurrenceDatesInPeriod({
        anchorDate: currentAnchorDate,
        startDate: currentStartDate,
        endDate: current.endDate ? toDateString(current.endDate) : null,
        frequency: current.frequency,
        period: getPeriodFromDate(validated.purchaseDate),
      }).includes(validated.purchaseDate);
    const versions = await listRecurringRulesBySeriesForUser(current.seriesId, userId);
    const scheduleChanged = !keepsCurrentSchedule || validated.purchaseDate !== selectedDate;
    if (
      scheduleChanged &&
      (query.scope === "single" || (query.scope === "series" && versions.length > 1))
    ) {
      throw badRequest(
        "Recurring schedule changes require future scope for a versioned series",
        "RECURRING_SCHEDULE_SCOPE_UNSUPPORTED",
      );
    }
    const nextAnchorDate = scheduleChanged ? validated.purchaseDate : currentAnchorDate;
    const nextStartDate = keepsCurrentSchedule ? currentStartDate : validated.purchaseDate;
    const previousDate = toDateString(new Date(toDate(selectedDate).getTime() - 86_400_000));
    const firstDate = getNextRecurringOccurrenceDate({
      anchorDate: currentAnchorDate,
      currentDate: toDateString(new Date(current.startDate.getTime() - 86_400_000)),
      endDate: current.endDate ? toDateString(current.endDate) : null,
      frequency: current.frequency,
      startDate: currentStartDate,
    });
    const followingDate = getNextRecurringOccurrenceDate({
      anchorDate: currentAnchorDate,
      currentDate: selectedDate,
      endDate: current.endDate ? toDateString(current.endDate) : null,
      frequency: current.frequency,
      startDate: currentStartDate,
    });
    const rule = await translateTransferBalanceError(() =>
      updateRecurringRuleWithSplitsForUser(
        id,
        userId,
        {
          personId: validated.personId,
          type: validated.type,
          paymentMethod: validated.paymentMethod,
          name: validated.name.trim(),
          amount: normalizeTransactionAmount(validated.type, validated.amount).toFixed(2),
          accountId: base.accountId,
          cardId: base.cardId,
          categoryId: base.categoryId,
          tagIds: input.tagIds,
          ...(endDateChanged
            ? {
                recurrenceEndDate: validated.recurrenceEndDate
                  ? toDate(validated.recurrenceEndDate)
                  : null,
              }
            : {}),
          sourceAccountId: base.sourceAccountId,
          destinationAccountId: base.destinationAccountId,
          dueDate: base.dueDate,
          dueDateRuleExcluded: base.dueDateRuleExcluded,
          note: base.note,
          ...(query.scope !== "series" ? { isSettled: base.isSettled } : {}),
          ...(versions.length === 1 && query.scope === "series"
            ? {
                anchorDate: toDate(nextAnchorDate),
                startDate: toDate(nextStartDate),
                frequency: validated.recurrenceFrequency as NonNullable<
                  TransactionInput["recurrenceFrequency"]
                >,
                isSettled: base.isSettled,
              }
            : {}),
          ...(scheduleChanged && query.scope === "future"
            ? {
                anchorDate: toDate(nextAnchorDate),
                frequency: validated.recurrenceFrequency as NonNullable<
                  TransactionInput["recurrenceFrequency"]
                >,
              }
            : {}),
        },
        (validated.splitShares ?? []).map((share) => ({
          personId: share.personId,
          amount: normalizeTransactionAmount(validated.type, share.amount).toFixed(2),
        })),
        {
          scope: query.scope,
          occurrenceDate: toDate(selectedDate),
          previousDate: toDate(previousDate),
          nextDate: followingDate ? toDate(followingDate) : null,
          hasPrevious: firstDate !== selectedDate,
          reschedule: scheduleChanged && query.scope === "future",
          expectedVersions: versions.map(({ id: versionId, updatedAt }) => ({
            id: versionId,
            updatedAt,
          })),
        },
      ),
    );
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    if ("conflict" in rule) {
      throw conflict("Recurring rule changed", "RECURRING_RULE_CHANGED");
    }
    const output = toRecurringOccurrenceOutput(
      rule,
      validated.purchaseDate,
      derivePeriod(validated, context, validated.purchaseDate),
      getRecurringDueDate(rule.dueDate ? toDateString(rule.dueDate) : null, validated.purchaseDate),
    );
    const occurrenceStates = await listRecurringOccurrencesForUser(
      [rule.seriesId],
      toDate(validated.purchaseDate),
      toDate(validated.purchaseDate),
      userId,
    );
    const occurrenceState = occurrenceStates.find(
      (occurrence) => toDateString(occurrence.purchaseDate) === validated.purchaseDate,
    );
    output.isSettled = occurrenceState?.isSettled ?? output.isSettled;
    output.dueDateRuleExcluded = occurrenceState?.dueDateRuleExcluded ?? output.dueDateRuleExcluded;
    const savedSplits = await listRecurringSplitsForUser([rule.id], userId);
    output.splitShares = savedSplits.map((share) => ({
      personId: share.personId,
      personName: share.personName,
      personAvatarUrl: share.personAvatarUrl,
      amount: Math.abs(Number(share.amount)),
    }));
    output.isDivided = savedSplits.length > 0;
    const earliestStartDate = versions[0] ? toDateString(versions[0].startDate) : currentStartDate;
    await synchronizeRecurringExternalExpensesFrom(
      userId,
      query.scope === "series"
        ? earliestStartDate < nextStartDate
          ? earliestStartDate
          : nextStartDate
        : selectedDate,
    );
    return presentTransaction(
      output,
      userId,
      rule.seriesId,
      occurrenceState?.frozenDueDate ? toDateString(occurrenceState.frozenDueDate) : null,
      occurrenceState?.dueDateAdjustment,
    );
  }

  async function copyTransaction(id: string, userId: string) {
    const current = await findTransactionByIdForUser(id, userId);
    if (!current) throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    if (current.paymentMethod === null) {
      throw badRequest("Balance adjustments cannot be copied", "BALANCE_ADJUSTMENT_IMMUTABLE");
    }
    if (current.origin !== "regular") {
      throw badRequest(
        "Generated transactions cannot be copied",
        "GENERATED_TRANSACTION_IMMUTABLE",
      );
    }
    const splits = await listTransactionSplitsForUser([id], userId);
    let amount = toDisplayAmount(current.amount);
    let splitShares = splits.map((share) => ({
      personId: share.personId,
      amount: Math.abs(Number(share.amount)),
    }));
    if (current.condition === "installment") {
      const series = current.seriesId
        ? await findInstallmentSeriesByIdForUser(current.seriesId, userId)
        : undefined;
      if (!series) throw notFound("Installment series not found", "INSTALLMENT_SERIES_NOT_FOUND");
      amount = toDisplayAmount(series.originalAmount);
      if (splitShares.length) {
        const allocations = allocateAmountProportionally(
          amount,
          splitShares.map((share) => share.amount),
        );
        splitShares = splitShares.map((share, index) => ({
          ...share,
          amount: allocations[index] as number,
        }));
      }
    }
    const copied = await createTransaction({
      userId,
      type: current.type,
      condition: current.condition,
      paymentMethod: current.paymentMethod,
      name: `${current.name} (cópia)`,
      amount,
      purchaseDate: toDateString(current.purchaseDate),
      personId: current.personId,
      accountId: current.accountId,
      cardId: current.cardId,
      categoryId: current.categoryId,
      tagIds: current.tagIds,
      sourceAccountId: current.sourceAccountId,
      destinationAccountId: current.destinationAccountId,
      dueDate: current.dueDate ? toDateString(current.dueDate) : null,
      installmentCount: current.installmentCount,
      recurrenceFrequency: null,
      isSettled: current.isSettled,
      note: current.note,
      splitShares,
    });
    if (copied.recordId) await copyTransactionAttachmentLinksForUser(id, copied.recordId, userId);
    return copied;
  }

  async function synchronizeRecurringExternalExpenses(ownerUserId: string, period: string) {
    try {
      await recurringExternalExpenses.synchronize(ownerUserId, period);
    } catch (error) {
      console.error("recurring_external_expense_sync_failed", { ownerUserId, period, error });
    }
  }

  async function synchronizeRecurringExternalExpensesFrom(ownerUserId: string, date: string) {
    const current = getCurrentPeriodInBrazil();
    for (const period of listPeriodsBetween(date.slice(0, 7), current)) {
      await synchronizeRecurringExternalExpenses(ownerUserId, period);
    }
  }

  async function copyRecurringRule(id: string, userId: string) {
    const rule = await findRecurringRuleByIdForUser(id, userId);
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const splits = await listRecurringSplitsForUser([id], userId);
    return createTransaction({
      userId,
      type: rule.type,
      condition: "recurring",
      paymentMethod: rule.paymentMethod,
      name: `${rule.name} (cópia)`,
      amount: toDisplayAmount(rule.amount),
      purchaseDate: toDateString(rule.startDate),
      personId: rule.personId,
      accountId: rule.accountId,
      cardId: rule.cardId,
      categoryId: rule.categoryId,
      tagIds: rule.tagIds,
      sourceAccountId: rule.sourceAccountId,
      destinationAccountId: rule.destinationAccountId,
      dueDate: rule.dueDate ? toDateString(rule.dueDate) : null,
      recurrenceFrequency: rule.frequency,

      recurrenceEndDate: rule.recurrenceEndDate ? toDateString(rule.recurrenceEndDate) : null,
      isSettled: rule.isSettled,
      note: rule.note,
      splitShares: splits.map((share) => ({
        personId: share.personId,
        amount: Math.abs(Number(share.amount)),
      })),
    });
  }

  return {
    changeRecurringRuleStatus,
    previewInstallmentOptions: (input: InstallmentOptionsQuery, _userId: string) => ({
      options: previewInstallmentOptions(input.amount),
    }),
    previewRecurrenceEndDate: (input: RecurrenceEndDateQuery, _userId: string) => ({
      endDate: calculateRecurrenceEndDate(input),
    }),
    applyRecurringRuleAction,
    categorizeTransactions,
    copyRecurringRule,
    copyTransaction,
    createTransaction,
    createTransactionFromInbox: (
      data: TransactionInput,
      userId: string,
      inboxItemId: string,
      confirmedAt: Date,
    ) =>
      createTransaction(
        { ...data, userId },
        { source: "inbox", sourceId: inboxItemId, confirmedAt },
      ),
    createTransactionFromExternalExpense: (
      data: TransactionInput,
      userId: string,
      externalExpenseId: string,
      expectedVersion: number,
      confirmedAt: Date,
      installmentAmounts?: number[],
    ) =>
      createTransaction(
        { ...data, userId },
        {
          source: "externalExpense",
          sourceId: externalExpenseId,
          expectedVersion,
          confirmedAt,
          installmentAmounts,
        },
      ),
    createTransactionRefund,
    deleteTransaction,
    deleteTransactions,
    exportTransactions,
    generateTransactionImportTemplate,
    getTransactionById,
    getRecurringRuleOccurrence,
    importTransactions,
    listRecentEstablishments,
    listTransactions,
    previewTransactionImport,
    renameTransactions,
    settleRecurringOccurrence,
    settleTransactions,
    tagTransactions,
    undoTransactionImport,
    updateRecurringRule,
    updateTransaction,
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;

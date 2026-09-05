import { createHash, randomUUID } from "node:crypto";
import {
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import {
  internalTransferCategoryName,
  invoicePaymentCategoryName,
} from "@openmonetis/domain/categories";
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
  calculateRefund,
  canDeleteTransactionOrigin,
  deriveImportedPeriod,
  deriveTransactionPeriod,
  getPeriodFromDate,
  InsufficientTransferBalanceError,
  listRecurrenceDatesInPeriod,
  normalizeImportedAmount,
  normalizeImportedDescriptionKey,
  normalizeImportedType,
  normalizeTransactionAmount,
  parseOfxStatement,
  projectTransactionAllocations,
  splitAmountIntoInstallments,
  toDisplayAmount,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  CreateTransactionRefundInput,
  ImportTransactionsInput,
  ListTransactionsQuery,
  PreviewTransactionImportInput,
  TransactionActionScope,
  TransactionInput,
  TransactionOutput,
  TransactionRefundOutput,
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
import type { AttachmentsService } from "./attachments.service";

type TransactionsRepositoryModule = typeof import("../repositories/transactions.repository");

export type TransactionsServiceDependencies = Pick<
  TransactionsRepositoryModule,
  | "copyTransactionAttachmentLinksForUser"
  | "deleteTransactionForUser"
  | "deleteTransactionImportBatchForUser"
  | "deleteTransactionSeriesForUser"
  | "deleteTransactionSeriesRangeForUser"
  | "deleteTransferPairForUser"
  | "findRecurringRuleByIdForUser"
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
  | "listRecurringRulesForPeriod"
  | "listRecurringSplitsForUser"
  | "listTransactionIdsWithAttachmentsForUser"
  | "listTransactionSeriesForUser"
  | "listTransactionSplitsForUser"
  | "listTransactionsByPeriod"
  | "listTransactionsByPurchaseDateRange"
  | "settleRecurringOccurrenceForUser"
  | "settleTransactionsForUser"
  | "updateRecurringRuleStatusForUser"
  | "updateRecurringRuleWithSplitsForUser"
  | "updateTransactionSeriesRangeWithSplitsForUser"
  | "updateTransactionWithSplitsForUser"
  | "updateTransferPairForUser"
> & {
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
  const {
    copyTransactionAttachmentLinksForUser,
    deleteTransactionForUser,
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
    listImportCategoryMappingsForUser,
    listImportedExternalIdsForUser,
    listPaidInvoicePeriodsForUser,
    listPeopleByIdsForUser,
    listRecentEstablishmentNamesForUser,
    listRecurringOccurrencesForUser,
    listRecurringRulesForPeriod,
    listRecurringSplitsForUser,
    listTransactionIdsWithAttachmentsForUser,
    listTransactionSeriesForUser,
    listTransactionSplitsForUser,
    listTransactionsByPeriod,
    listTransactionsByPurchaseDateRange,
    settleRecurringOccurrenceForUser,
    settleTransactionsForUser,
    updateRecurringRuleStatusForUser,
    updateRecurringRuleWithSplitsForUser,
    updateTransactionSeriesRangeWithSplitsForUser,
    updateTransactionWithSplitsForUser,
    updateTransferPairForUser,
  } = dependencies;
  const recentEstablishmentsService = createRecentEstablishmentsService({
    listRecentNamesForUser: listRecentEstablishmentNamesForUser,
  });

  function listRecentEstablishments(userId: string) {
    return recentEstablishmentsService.list(userId);
  }

  function getPeriodEnd(period: string) {
    const [year, month] = period.split("-").map(Number);

    return new Date(Date.UTC(year, month, 0));
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

  function getRecurringOccurrenceDueDate(ruleDueDate: Date | null, purchaseDate: string) {
    if (!ruleDueDate) {
      return null;
    }

    const purchase = toDate(purchaseDate);
    const lastDay = new Date(
      Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const dueDate = new Date(
      Date.UTC(
        purchase.getUTCFullYear(),
        purchase.getUTCMonth(),
        Math.min(ruleDueDate.getUTCDate(), lastDay),
      ),
    );

    return toDateString(dueDate);
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
      allocation: null,
      purchaseDate: toDateString(transaction.purchaseDate),
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
    dueDate = rule.dueDate ? toDateString(rule.dueDate) : null,
  ): TransactionOutput {
    const amount = Number(rule.amount);

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
      allocation: null,
      purchaseDate,
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
      boletoPaymentDate: null,
      installmentCount: null,
      currentInstallment: null,
      installmentEndPeriod: null,
      recurrenceFrequency: rule.frequency,
      isSettled: rule.isSettled,
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
        (category.type !== data.type || category.name === invoicePaymentCategoryName))
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

    return {
      userId: data.userId,
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
      boletoPaymentDate: data.boletoPaymentDate ? toDate(data.boletoPaymentDate) : null,
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
          !category || category.type !== row.type || category.name === invoicePaymentCategoryName
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

      return toTransactionOutput(outgoingTransaction);
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
          startDate: toDate(data.purchaseDate),
          endDate: null,
          frequency: data.recurrenceFrequency as NonNullable<
            TransactionInput["recurrenceFrequency"]
          >,
          accountId: base.accountId,
          cardId: base.cardId,
          categoryId: base.categoryId,
          sourceAccountId: base.sourceAccountId,
          destinationAccountId: base.destinationAccountId,
          dueDate: base.dueDate,
          isSettled: base.isSettled,
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

      await synchronizeRecurringExternalExpenses(data.userId, data.purchaseDate.slice(0, 7));

      return toRecurringOccurrenceOutput(rule, data.purchaseDate, basePeriod);
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

      return toTransactionOutput(firstTransaction);
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

    return toTransactionOutput(transaction);
  }

  async function listTransactions(userId: string, query: ListTransactionsQuery) {
    const period = query.period ?? currentPeriod();
    const periodEnd = query.dateEnd ? toDate(query.dateEnd) : getPeriodEnd(period);
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
    const [transactions, recurringRules] = await Promise.all([
      query.dateStart || query.dateEnd
        ? listTransactionsByPurchaseDateRange(
            userId,
            query.dateStart ? toDate(query.dateStart) : undefined,
            query.dateEnd ? toDate(query.dateEnd) : undefined,
            persistedFilters,
          )
        : listTransactionsByPeriod(userId, period, persistedFilters),
      listRecurringRulesForPeriod(userId, periodEnd),
    ]);
    const occurrencePeriods =
      query.dateStart || query.dateEnd
        ? listPeriodsBetween(getPeriodFromDate(periodStart), getPeriodFromDate(periodEnd))
        : [getEarlierPeriod(period), getPreviousPeriod(period), period];
    const recurringOccurrences = recurringRules.flatMap((rule) => {
      const occurrenceDates = occurrencePeriods.flatMap((occurrencePeriod) =>
        listRecurrenceDatesInPeriod({
          startDate: toDateString(rule.startDate),
          endDate: rule.endDate ? toDateString(rule.endDate) : null,
          frequency: rule.frequency,
          period: occurrencePeriod,
        }),
      );

      return occurrenceDates
        .map((purchaseDate) => {
          const dueDate = getRecurringOccurrenceDueDate(rule.dueDate, purchaseDate);
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
                    }),
                    dueDay: Number(rule.cardDueDay),
                  }
                : null,
          });

          const isInDateRange =
            purchaseDate >= toDateString(periodStart) && purchaseDate <= toDateString(periodEnd);

          return (query.dateStart || query.dateEnd ? isInDateRange : occurrencePeriod === period)
            ? toRecurringOccurrenceOutput(rule, purchaseDate, occurrencePeriod, dueDate)
            : null;
        })
        .filter((transaction): transaction is TransactionOutput => Boolean(transaction));
    });
    const transactionSplits = await listTransactionSplitsForUser(
      transactions.map((transaction) => transaction.id),
      userId,
    );
    const ruleIds = recurringRules.map((rule) => rule.id);
    const [recurringSplits, recurringOccurrenceStates] = await Promise.all([
      listRecurringSplitsForUser(ruleIds, userId),
      listRecurringOccurrencesForUser(ruleIds, periodStart, periodEnd, userId),
    ]);
    const occurrenceStates = new Map(
      recurringOccurrenceStates.map((occurrence) => [
        `${occurrence.recurringRuleId}:${toDateString(occurrence.purchaseDate)}`,
        occurrence.isSettled,
      ]),
    );
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
    ].map((item) => ({
      ...item,
      isSettled:
        item.isRecurring && item.recurringRuleId
          ? (occurrenceStates.get(`${item.recurringRuleId}:${item.purchaseDate}`) ?? item.isSettled)
          : item.isSettled,
      splitShares: (item.recurringRuleId
        ? recurringSplits.filter((split) => split.recurringRuleId === item.recurringRuleId)
        : transactionSplits.filter((split) => split.transactionId === item.recordId)
      ).map((split) => ({
        personId: split.personId,
        personName: split.personName,
        personAvatarUrl: split.personAvatarUrl,
        amount: Math.abs(Number(split.amount)),
      })),
      isDivided: item.recurringRuleId
        ? recurringSplits.some((split) => split.recurringRuleId === item.recurringRuleId)
        : transactionSplits.some((split) => split.transactionId === item.recordId),
      hasAttachments: item.recordId ? attachedTransactions.has(item.recordId) : false,
    }));
    const output = hydratedTransactions.flatMap((item) =>
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
      .filter((item) => matchesTransactionFilters(item, query))
      .sort(
        (a, b) =>
          b.purchaseDate.localeCompare(a.purchaseDate) ||
          a.name.localeCompare(b.name) ||
          (a.allocation?.personName ?? a.personName).localeCompare(
            b.allocation?.personName ?? b.personName,
          ) ||
          a.id.localeCompare(b.id),
      );
    const start = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  function listPeriodsBetween(startPeriod: string, endPeriod: string) {
    const periods: string[] = [];
    for (let period = startPeriod; period <= endPeriod; period = addMonthsToPeriod(period, 1)) {
      periods.push(period);
    }
    return periods;
  }

  function matchesTransactionFilters(item: TransactionOutput, query: ListTransactionsQuery) {
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
      (!query.type || item.type === query.type) &&
      (!query.condition || item.condition === query.condition) &&
      (!query.paymentMethod || item.paymentMethod === query.paymentMethod) &&
      (!query.settlement ||
        (query.settlement === "paid" ? item.isSettled === true : item.isSettled === false)) &&
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

  async function getTransactionById(id: string, userId: string) {
    const transaction = await findTransactionByIdForUser(id, userId);

    if (!transaction) {
      throw notFound("Transaction not found", "TRANSACTION_NOT_FOUND");
    }

    const [splits, attached] = await Promise.all([
      listTransactionSplitsForUser([id], userId),
      listTransactionIdsWithAttachmentsForUser([id], userId),
    ]);
    const output = toTransactionOutput(transaction);

    return {
      ...output,
      splitShares: splits.map((split) => ({
        personId: split.personId,
        personName: split.personName,
        personAvatarUrl: split.personAvatarUrl,
        amount: Math.abs(Number(split.amount)),
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
      amount: data.amount ?? toDisplayAmount(current.amount),
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
      dueDate:
        data.dueDate === undefined
          ? current.dueDate
            ? toDateString(current.dueDate)
            : null
          : data.dueDate,
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
      splitShares:
        data.splitShares === undefined
          ? currentSplits.length
            ? currentSplits.map((split) => ({
                personId: split.personId,
                amount: Math.abs(Number(split.amount)),
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
    const base = buildBaseRecord({ ...validatedMerged, userId }, context);
    const values: TransactionUpdateRecord = {
      ...base,
      amount: normalizeTransactionAmount(validatedMerged.type, validatedMerged.amount).toFixed(2),
      purchaseDate: toDate(validatedMerged.purchaseDate),
      period: derivePeriod(validatedMerged, context, validatedMerged.purchaseDate),
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
      const updated = await updateTransactionSeriesRangeWithSplitsForUser(
        userId,
        targets.map((target) => {
          const offset = (target.currentInstallment as number) - anchorInstallment;
          const targetAmount =
            data.amount === undefined ? toDisplayAmount(target.amount) : validatedMerged.amount;
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
                  ? target.amount
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
    const transaction = await updateTransactionWithSplitsForUser(
      id,
      userId,
      values,
      data.splitShares === undefined
        ? undefined
        : (validatedMerged.splitShares ?? []).map((share) => ({
            personId: share.personId,
            amount: normalizeTransactionAmount(validatedMerged.type, share.amount).toFixed(2),
          })),
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

  async function settleTransactions(ids: string[], userId: string, isSettled: boolean) {
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
        toDate(getCurrentDateInBrazil()),
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
  ) {
    const rule = await findRecurringRuleByIdForUser(recurringRuleId, userId);
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const validDates = listRecurrenceDatesInPeriod({
      startDate: toDateString(rule.startDate),
      endDate: rule.endDate ? toDateString(rule.endDate) : null,
      frequency: rule.frequency,
      period: getPeriodFromDate(purchaseDate),
    });
    if (!validDates.includes(purchaseDate)) {
      throw badRequest("Invalid recurring occurrence date", "INVALID_RECURRING_OCCURRENCE");
    }
    const occurrence = await settleRecurringOccurrenceForUser(
      recurringRuleId,
      toDate(purchaseDate),
      userId,
      isSettled,
      rule.paymentMethod === "boleto" && isSettled ? toDate(getCurrentDateInBrazil()) : null,
    );
    if (!occurrence) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    return { recurringRuleId, purchaseDate, isSettled };
  }

  async function changeRecurringRuleStatus(
    id: string,
    userId: string,
    status: "active" | "paused" | "cancelled",
  ) {
    const updated = await updateRecurringRuleStatusForUser(id, userId, status);
    if (!updated) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    await synchronizeRecurringExternalExpenses(userId, getCurrentPeriodInBrazil());
    return { id, status };
  }

  async function updateRecurringRule(id: string, userId: string, input: TransactionInput) {
    const current = await findRecurringRuleByIdForUser(id, userId);
    if (!current) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const validated = TransactionInputSchema.parse({
      ...input,
      condition: "recurring",
      recurrenceFrequency: input.recurrenceFrequency ?? current.frequency,
      invoicePeriod: null,
    });
    assertBoletoPaymentDateIsNotFuture(validated);
    const context = await assertOwnership(validated, userId);
    const base = buildBaseRecord({ ...validated, userId }, context);
    const rule = await updateRecurringRuleWithSplitsForUser(
      id,
      userId,
      {
        personId: validated.personId,
        type: validated.type,
        paymentMethod: validated.paymentMethod,
        name: validated.name.trim(),
        amount: normalizeTransactionAmount(validated.type, validated.amount).toFixed(2),
        startDate: toDate(validated.purchaseDate),
        frequency: validated.recurrenceFrequency as NonNullable<
          TransactionInput["recurrenceFrequency"]
        >,
        accountId: base.accountId,
        cardId: base.cardId,
        categoryId: base.categoryId,
        sourceAccountId: base.sourceAccountId,
        destinationAccountId: base.destinationAccountId,
        dueDate: base.dueDate,
        isSettled: base.isSettled,
        note: base.note,
      },
      (validated.splitShares ?? []).map((share) => ({
        personId: share.personId,
        amount: normalizeTransactionAmount(validated.type, share.amount).toFixed(2),
      })),
    );
    if (!rule) throw notFound("Recurring rule not found", "RECURRING_RULE_NOT_FOUND");
    const output = toRecurringOccurrenceOutput(
      rule,
      validated.purchaseDate,
      derivePeriod(validated, context, validated.purchaseDate),
    );
    const savedSplits = await listRecurringSplitsForUser([id], userId);
    output.splitShares = savedSplits.map((share) => ({
      personId: share.personId,
      personName: share.personName,
      personAvatarUrl: share.personAvatarUrl,
      amount: Math.abs(Number(share.amount)),
    }));
    output.isDivided = savedSplits.length > 0;
    await synchronizeRecurringExternalExpenses(userId, getCurrentPeriodInBrazil());
    return output;
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
    const copied = await createTransaction({
      userId,
      type: current.type,
      condition: current.condition,
      paymentMethod: current.paymentMethod,
      name: `${current.name} (cópia)`,
      amount:
        current.condition === "installment" && current.installmentCount
          ? toDisplayAmount(current.amount) * current.installmentCount
          : toDisplayAmount(current.amount),
      purchaseDate: toDateString(current.purchaseDate),
      personId: current.personId,
      accountId: current.accountId,
      cardId: current.cardId,
      categoryId: current.categoryId,
      sourceAccountId: current.sourceAccountId,
      destinationAccountId: current.destinationAccountId,
      dueDate: current.dueDate ? toDateString(current.dueDate) : null,
      installmentCount: current.installmentCount,
      recurrenceFrequency: null,
      isSettled: current.isSettled,
      note: current.note,
      splitShares: splits.map((share) => ({
        personId: share.personId,
        amount:
          current.condition === "installment" && current.installmentCount
            ? Math.abs(Number(share.amount)) * current.installmentCount
            : Math.abs(Number(share.amount)),
      })),
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
      sourceAccountId: rule.sourceAccountId,
      destinationAccountId: rule.destinationAccountId,
      dueDate: rule.dueDate ? toDateString(rule.dueDate) : null,
      recurrenceFrequency: rule.frequency,
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
    generateTransactionImportTemplate,
    getTransactionById,
    importTransactions,
    listRecentEstablishments,
    listTransactions,
    previewTransactionImport,
    settleRecurringOccurrence,
    settleTransactions,
    undoTransactionImport,
    updateRecurringRule,
    updateTransaction,
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;

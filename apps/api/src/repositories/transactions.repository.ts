import {
  attachments,
  type Card,
  cards,
  categories,
  db,
  establishmentLogos,
  externalExpenses,
  financialAccounts,
  importCategoryMappings,
  inboxItems,
  installmentAnticipationItems,
  installmentSeries,
  invoicePayments,
  invoices,
  people,
  type RecurringTransactionRule,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionRuleTags,
  recurringTransactionSeries,
  recurringTransactionSplits,
  settlementEvents,
  type Transaction,
  transactionAttachments,
  transactionRefunds,
  transactionSplits,
  transactions,
  transactionTags,
} from "@openmonetis/db";
import { createEstablishmentNameKey } from "@openmonetis/domain/establishments";
import { selectNewExternalExpenseAssignmentKeys } from "@openmonetis/domain/external-expenses";
import { planRecurringScheduleChange } from "@openmonetis/domain/recurring-transactions";
import { SettlementError } from "@openmonetis/domain/settlements";
import {
  assertTransferWithinAvailableBalance,
  selectRecurringRuleVersionsToUpdate,
} from "@openmonetis/domain/transactions";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notInArray,
  notLike,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { categoryLabelSql } from "./categories.repository";
import {
  deletePendingExternalExpensesForTransactions,
  findExternalExpenseAssignmentKeys,
  synchronizePendingExternalExpensesForTransactions,
} from "./external-expenses.repository";
import { effectiveRecurringEndDateSql } from "./recurring-transactions.repository";
import {
  effectiveSplitAmountSql,
  effectiveTransactionAmountSql,
  recurringOccurrenceOverridesSql,
  settlePersistedTransactions,
  settleRecurringTransaction,
} from "./settlements.repository";

import {
  readRecurringRuleTagIds,
  replaceRecurringRuleTags,
  replaceTransactionTags,
} from "./tags.repository";

function withoutTagIds<T extends { tagIds?: string[] }>({ tagIds: _tagIds, ...record }: T) {
  return record;
}

const transactionAccounts = alias(financialAccounts, "transaction_accounts");
const occurrenceAccounts = alias(financialAccounts, "occurrence_accounts");
const sourceAccounts = alias(financialAccounts, "source_accounts");
const destinationAccounts = alias(financialAccounts, "destination_accounts");
const balanceSplitPeople = alias(people, "transfer_balance_split_people");

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceTransactionSplits(
  transaction: DatabaseTransaction,
  transactionId: string,
  userId: string,
  splits: Array<{ personId: string; amount: string }>,
) {
  if (splits.length) {
    await transaction.delete(transactionSplits).where(
      and(
        eq(transactionSplits.transactionId, transactionId),
        eq(transactionSplits.userId, userId),
        notInArray(
          transactionSplits.personId,
          splits.map((split) => split.personId),
        ),
      ),
    );
    await transaction
      .insert(transactionSplits)
      .values(splits.map((split) => ({ ...split, transactionId, userId })))
      .onConflictDoUpdate({
        target: [transactionSplits.transactionId, transactionSplits.personId],
        set: { amount: sql`excluded.amount` },
      });
    return;
  }
  await transaction
    .delete(transactionSplits)
    .where(
      and(eq(transactionSplits.transactionId, transactionId), eq(transactionSplits.userId, userId)),
    );
}

export type TransactionCreateRecord = Omit<
  Transaction,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "settledAmount"
  | "settledDate"
  | "dueDateAdjustment"
  | "frozenDueDate"
  | "dueDateRuleExcluded"
> & {
  dueDateAdjustment?: import("@openmonetis/domain/due-date-rules").DueDateAdjustmentDetails | null;
  frozenDueDate?: Date | null;
  dueDateRuleExcluded?: boolean;
  settledAmount?: string | null;
  settledDate?: Date | null;
  tagIds?: string[];
};
type InstallmentSeriesCreateRecord = {
  id: string;
  userId: string;
  totalInstallments: number;
  trackedFromInstallment: number;
  originalAmount: string;
};
type RecurringRuleCreateRecord = Omit<
  RecurringTransactionRule,
  "id" | "seriesId" | "createdAt" | "updatedAt" | "recurrenceEndDate" | "dueDateRuleExcluded"
> & {
  dueDateRuleExcluded?: boolean;
  tagIds?: string[];
  recurrenceEndDate?: Date | null;
};
type RecurringRuleUpdateRecord = Partial<Omit<RecurringRuleCreateRecord, "userId">>;
type TransactionConfirmation =
  | {
      source: "inbox";
      sourceId: string;
      userId: string;
      confirmedAt: Date;
    }
  | {
      source: "externalExpense";
      sourceId: string;
      userId: string;
      expectedVersion: number;
      confirmedAt: Date;
    };

const transactionConfirmationConflict = new Error("transaction_confirmation_conflict");

async function confirmTransactionSource(
  transaction: DatabaseTransaction,
  confirmation: TransactionConfirmation | undefined,
  transactionId: string | undefined,
) {
  if (!confirmation) return;
  if (!transactionId) throw transactionConfirmationConflict;

  if (confirmation.source === "externalExpense") {
    const [expense] = await transaction
      .select({
        id: externalExpenses.id,
        establishmentLogoDomain: externalExpenses.establishmentLogoDomain,
        name: externalExpenses.name,
      })
      .from(externalExpenses)
      .where(
        and(
          eq(externalExpenses.id, confirmation.sourceId),
          eq(externalExpenses.recipientUserId, confirmation.userId),
          eq(externalExpenses.status, "pending"),
          eq(externalExpenses.sourceVersion, confirmation.expectedVersion),
        ),
      )
      .for("update")
      .limit(1);
    if (!expense) throw transactionConfirmationConflict;

    const [accepted] = await transaction
      .update(externalExpenses)
      .set({
        status: "imported",
        importedTransactionId: transactionId,
        importedAt: confirmation.confirmedAt,
        updatedAt: confirmation.confirmedAt,
      })
      .where(
        and(
          eq(externalExpenses.id, expense.id),
          eq(externalExpenses.recipientUserId, confirmation.userId),
          eq(externalExpenses.status, "pending"),
          eq(externalExpenses.sourceVersion, confirmation.expectedVersion),
        ),
      )
      .returning({ id: externalExpenses.id });
    if (!accepted) throw transactionConfirmationConflict;
    if (expense.establishmentLogoDomain) {
      await transaction
        .insert(establishmentLogos)
        .values({
          userId: confirmation.userId,
          nameKey: createEstablishmentNameKey(expense.name),
          domain: expense.establishmentLogoDomain,
          updatedAt: confirmation.confirmedAt,
        })
        .onConflictDoNothing();
    }
    return;
  }

  const [updated] = await transaction
    .update(inboxItems)
    .set({
      status: "processed",
      transactionId,
      processedAt: confirmation.confirmedAt,
      discardedAt: null,
      updatedAt: confirmation.confirmedAt,
    })
    .where(
      and(
        eq(inboxItems.id, confirmation.sourceId),
        eq(inboxItems.userId, confirmation.userId),
        eq(inboxItems.status, "pending"),
        isNull(inboxItems.transactionId),
      ),
    )
    .returning({ id: inboxItems.id });

  if (!updated) throw transactionConfirmationConflict;
}

type PersistedTransactionFilters = {
  accountIds?: string[];
  cardIds?: string[];
  categoryIds?: string[];
  condition?: Transaction["condition"];
  hasAttachments?: boolean;
  hasDueDate?: boolean;
  isDivided?: boolean;
  maxAmount?: number;
  minAmount?: number;
  paymentMethod?: NonNullable<Transaction["paymentMethod"]>;
  personIds?: string[];
  type?: Transaction["type"];
};

export type TransactionUpdateRecord = Partial<
  Pick<
    TransactionCreateRecord,
    | "personId"
    | "type"
    | "condition"
    | "paymentMethod"
    | "name"
    | "amount"
    | "purchaseDate"
    | "period"
    | "accountId"
    | "cardId"
    | "categoryId"
    | "sourceAccountId"
    | "destinationAccountId"
    | "dueDateRuleExcluded"
    | "dueDate"
    | "boletoPaymentDate"
    | "settledDate"
    | "installmentCount"
    | "currentInstallment"
    | "isSettled"
    | "note"
    | "tagIds"
  >
>;

async function lockTransferSourceAccounts(
  transaction: DatabaseTransaction,
  userId: string,
  accountIds: Array<string | null | undefined>,
) {
  const uniqueAccountIds = [
    ...new Set(accountIds.filter((id): id is string => Boolean(id))),
  ].sort();

  for (const accountId of uniqueAccountIds) {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${accountId}:transfer-balance`}, 0))`,
    );
  }
}

async function getSettledAccountBalanceThroughPeriod(
  transaction: DatabaseTransaction,
  userId: string,
  accountId: string,
  period: string,
) {
  const [adminPostings] = await transaction
    .select({
      total: sql<string>`coalesce(sum(case when ${transactionSplits.id} is not null then ${effectiveSplitAmountSql} else ${effectiveTransactionAmountSql} end), 0)`,
    })
    .from(transactions)
    .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
    .leftJoin(
      transactionSplits,
      and(
        eq(transactionSplits.transactionId, transactions.id),
        eq(transactionSplits.userId, userId),
      ),
    )
    .leftJoin(
      balanceSplitPeople,
      and(
        eq(transactionSplits.personId, balanceSplitPeople.id),
        eq(balanceSplitPeople.userId, userId),
      ),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accountId),
        eq(transactions.isSettled, true),
        or(isNull(transactions.paymentMethod), ne(transactions.paymentMethod, "boleto")),
        sql`coalesce(to_char(${transactions.settledDate}, 'YYYY-MM'), ${transactions.period}) <= ${period}`,
        or(
          and(isNull(transactionSplits.id), eq(people.role, "admin")),
          eq(balanceSplitPeople.role, "admin"),
        ),
      ),
    );
  const [billPostings] = await transaction
    .select({ total: sql<string>`coalesce(sum(${effectiveTransactionAmountSql}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accountId),
        eq(transactions.isSettled, true),
        eq(transactions.type, "expense"),
        eq(transactions.paymentMethod, "boleto"),
        sql`coalesce(to_char(${transactions.settledDate}, 'YYYY-MM'), ${transactions.period}) <= ${period}`,
      ),
    );

  return (
    Number((adminPostings as { total: string }).total) +
    Number((billPostings as { total: string }).total)
  );
}

async function assertSufficientTransferBalance(
  transaction: DatabaseTransaction,
  input: {
    userId: string;
    sourceAccountId: string;
    amount: number;
    balanceSnapshot: {
      displayed: number;
      persisted: number;
    };
    period: string;
    replacedPostingEffect?: number;
  },
) {
  const currentBalance = await getSettledAccountBalanceThroughPeriod(
    transaction,
    input.userId,
    input.sourceAccountId,
    input.period,
  );
  assertTransferWithinAvailableBalance({
    amount: input.amount,
    availableBalance:
      input.balanceSnapshot.displayed +
      currentBalance -
      input.balanceSnapshot.persisted -
      (input.replacedPostingEffect ?? 0),
  });
}

export type TransactionWithRelations = Omit<
  Transaction,
  "settledAmount" | "settledDate" | "dueDateRuleExcluded" | "frozenDueDate" | "dueDateAdjustment"
> & {
  dueDateRuleExcluded?: boolean;
  dueDateAdjustment?: import("@openmonetis/domain/due-date-rules").DueDateAdjustmentDetails | null;
  frozenDueDate?: Date | null;
  settledAmount?: string | null;
  settledDate?: Date | null;
  plannedAmount?: string;
  tagIds?: string[];
  personName: string;
  personAvatarUrl: string | null;
  accountName: string | null;
  accountLogo: string | null;
  cardName: string | null;
  cardLogo: string | null;
  invoicePaymentCardName: string | null;
  invoicePaymentCardLogo: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  sourceAccountName: string | null;
  sourceAccountLogo: string | null;
  destinationAccountName: string | null;
  destinationAccountLogo: string | null;
  refundSourceId: string | null;
  refundedAmount: string;
  anticipationId: string | null;
  installmentOriginalPeriod: string | null;
};

export type RecurringRuleWithRelations = Omit<
  RecurringTransactionRule,
  "recurrenceEndDate" | "dueDateRuleExcluded"
> & {
  dueDateRuleExcluded?: boolean;
  occurrenceOverrides?: import("@openmonetis/domain/settlements").SettlementAwareRule["occurrenceOverrides"];
  recurrenceEndDate?: Date | null;
  configuredEndDate?: string | null;

  tagIds?: string[];
  personName: string;
  personAvatarUrl: string | null;
  accountName: string | null;
  accountLogo: string | null;
  cardName: string | null;
  cardLogo: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  sourceAccountName: string | null;
  sourceAccountLogo: string | null;
  destinationAccountName: string | null;
  destinationAccountLogo: string | null;
  cardClosingDay: number | null;
  cardClosingRuleType: Card["closingRuleType"] | null;
  cardClosingOffsetDays: number | null;
  cardClosingOffsetMode: Card["closingOffsetMode"] | null;
  cardClosingDayPurchasesNextInvoice: boolean | null;
  cardDueDay: number | null;
};

const transactionColumns = {
  tagIds: sql<
    string[]
  >`array(select ${transactionTags.tagId} from ${transactionTags} where ${transactionTags.transactionId} = ${transactions.id} and ${transactionTags.userId} = ${transactions.userId} order by ${transactionTags.tagId})`.as(
    "tag_ids",
  ),
  id: transactions.id,
  userId: transactions.userId,
  personId: transactions.personId,
  type: transactions.type,
  origin: transactions.origin,
  condition: transactions.condition,
  paymentMethod: transactions.paymentMethod,
  name: transactions.name,
  amount: effectiveTransactionAmountSql.as("amount"),
  plannedAmount: transactions.amount,
  settledAmount: transactions.settledAmount,
  settledDate: transactions.settledDate,
  purchaseDate: transactions.purchaseDate,
  period: transactions.period,
  accountId: transactions.accountId,
  cardId: transactions.cardId,
  categoryId: transactions.categoryId,
  sourceAccountId: transactions.sourceAccountId,
  destinationAccountId: transactions.destinationAccountId,
  dueDate: transactions.dueDate,
  dueDateRuleExcluded: transactions.dueDateRuleExcluded,
  frozenDueDate: transactions.frozenDueDate,
  dueDateAdjustment: transactions.dueDateAdjustment,
  boletoPaymentDate: transactions.boletoPaymentDate,
  installmentCount: transactions.installmentCount,
  currentInstallment: transactions.currentInstallment,
  seriesId: transactions.seriesId,
  transferId: transactions.transferId,
  recurringRuleId: transactions.recurringRuleId,
  isSettled: transactions.isSettled,
  note: transactions.note,
  importSourceFingerprint: transactions.importSourceFingerprint,
  importExternalId: transactions.importExternalId,
  importBatchId: transactions.importBatchId,
  createdAt: transactions.createdAt,
  updatedAt: transactions.updatedAt,
  personName: people.name,
  personAvatarUrl: people.avatarUrl,
  accountName: transactionAccounts.name,
  accountLogo: transactionAccounts.logo,
  cardName: cards.name,
  cardLogo: cards.logo,
  invoicePaymentCardName: sql<string | null>`(
    select ${cards.name}
    from ${invoicePayments}
    inner join ${cards}
      on ${cards.id} = ${invoicePayments.cardId}
      and ${cards.userId} = ${invoicePayments.userId}
    where ${invoicePayments.transactionId} = ${transactions.id}
      and ${invoicePayments.userId} = ${transactions.userId}
    limit 1
  )`.as("invoice_payment_card_name"),
  invoicePaymentCardLogo: sql<string | null>`(
    select ${cards.logo}
    from ${invoicePayments}
    inner join ${cards}
      on ${cards.id} = ${invoicePayments.cardId}
      and ${cards.userId} = ${invoicePayments.userId}
    where ${invoicePayments.transactionId} = ${transactions.id}
      and ${invoicePayments.userId} = ${transactions.userId}
    limit 1
  )`.as("invoice_payment_card_logo"),
  categoryName: categoryLabelSql(categories),
  categoryIcon: categories.icon,
  sourceAccountName: sourceAccounts.name,
  sourceAccountLogo: sourceAccounts.logo,
  destinationAccountName: destinationAccounts.name,
  destinationAccountLogo: destinationAccounts.logo,
  refundSourceId: sql<string | null>`(
    select ${transactionRefunds.sourceTransactionId}
    from ${transactionRefunds}
    where ${transactionRefunds.refundTransactionId} = ${transactions.id}
      and ${transactionRefunds.userId} = ${transactions.userId}
    limit 1
  )`.as("refund_source_id"),
  refundedAmount: sql<string>`coalesce((
    select sum(${transactionRefunds.amount})
    from ${transactionRefunds}
    where ${transactionRefunds.sourceTransactionId} = ${transactions.id}
      and ${transactionRefunds.userId} = ${transactions.userId}
  ), 0)`.as("refunded_amount"),
  anticipationId: sql<string | null>`(
    select ${installmentAnticipationItems.anticipationId}
    from ${installmentAnticipationItems}
    where ${installmentAnticipationItems.transactionId} = ${transactions.id}
      and ${installmentAnticipationItems.userId} = ${transactions.userId}
    limit 1
  )`.as("anticipation_id"),
  installmentOriginalPeriod: sql<string | null>`(
    select ${installmentAnticipationItems.originalPeriod}
    from ${installmentAnticipationItems}
    where ${installmentAnticipationItems.transactionId} = ${transactions.id}
      and ${installmentAnticipationItems.userId} = ${transactions.userId}
    limit 1
  )`.as("installment_original_period"),
};

const recurringRuleColumns = {
  tagIds: sql<
    string[]
  >`array(select ${recurringTransactionRuleTags.tagId} from ${recurringTransactionRuleTags} where ${recurringTransactionRuleTags.recurringRuleId} = ${recurringTransactionRules.id} and ${recurringTransactionRuleTags.userId} = ${recurringTransactionRules.userId} order by ${recurringTransactionRuleTags.tagId})`.as(
    "tag_ids",
  ),
  id: recurringTransactionRules.id,
  userId: recurringTransactionRules.userId,
  seriesId: recurringTransactionRules.seriesId,
  personId: recurringTransactionRules.personId,
  type: recurringTransactionRules.type,
  paymentMethod: recurringTransactionRules.paymentMethod,
  name: recurringTransactionRules.name,
  amount: recurringTransactionRules.amount,
  anchorDate: recurringTransactionRules.anchorDate,
  startDate: recurringTransactionRules.startDate,
  endDate: effectiveRecurringEndDateSql,

  configuredEndDate: sql<
    string | null
  >`to_char(${recurringTransactionRules.recurrenceEndDate}, 'YYYY-MM-DD')`.as(
    "configured_end_date",
  ),
  occurrenceOverrides: recurringOccurrenceOverridesSql,
  recurrenceEndDate: recurringTransactionRules.recurrenceEndDate,
  frequency: recurringTransactionRules.frequency,
  accountId: recurringTransactionRules.accountId,
  cardId: recurringTransactionRules.cardId,
  categoryId: recurringTransactionRules.categoryId,
  sourceAccountId: recurringTransactionRules.sourceAccountId,
  destinationAccountId: recurringTransactionRules.destinationAccountId,
  dueDate: recurringTransactionRules.dueDate,
  dueDateRuleExcluded: recurringTransactionRules.dueDateRuleExcluded,
  isSettled: recurringTransactionRules.isSettled,
  note: recurringTransactionRules.note,
  status: recurringTransactionRules.status,
  createdAt: recurringTransactionRules.createdAt,
  updatedAt: recurringTransactionRules.updatedAt,
  personName: people.name,
  personAvatarUrl: people.avatarUrl,
  accountName: transactionAccounts.name,
  accountLogo: transactionAccounts.logo,
  cardName: cards.name,
  cardLogo: cards.logo,
  categoryName: categoryLabelSql(categories),
  categoryIcon: categories.icon,
  sourceAccountName: sourceAccounts.name,
  sourceAccountLogo: sourceAccounts.logo,
  destinationAccountName: destinationAccounts.name,
  destinationAccountLogo: destinationAccounts.logo,
  cardClosingDay: cards.closingDay,
  cardClosingRuleType: cards.closingRuleType,
  cardClosingOffsetDays: cards.closingOffsetDays,
  cardClosingOffsetMode: cards.closingOffsetMode,
  cardClosingDayPurchasesNextInvoice: cards.closingDayPurchasesNextInvoice,
  cardDueDay: cards.dueDay,
};

export async function insertTransactionRefundForUser(data: {
  userId: string;
  sourceTransactionId: string;
  amount: number;
  record: TransactionCreateRecord;
  splits: Array<{ personId: string; amount: number }>;
}) {
  const refundId = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.sourceTransactionId}:refund`}, 0))`,
    );
    const [source] = await transaction
      .select({
        id: transactions.id,
        amount: effectiveTransactionAmountSql.as("amount"),
        type: transactions.type,
        origin: transactions.origin,
      })
      .from(transactions)
      .where(
        and(eq(transactions.id, data.sourceTransactionId), eq(transactions.userId, data.userId)),
      )
      .for("update");
    if (source?.type !== "expense" || source.origin !== "regular") return null;

    const [refundTotal] = await transaction
      .select({ amount: sql<string>`coalesce(sum(${transactionRefunds.amount}), 0)` })
      .from(transactionRefunds)
      .where(
        and(
          eq(transactionRefunds.userId, data.userId),
          eq(transactionRefunds.sourceTransactionId, data.sourceTransactionId),
        ),
      );
    const refundableCents =
      Math.round(Math.abs(Number(source.amount)) * 100) -
      Math.round(Number((refundTotal as { amount: string }).amount) * 100);
    if (Math.round(data.amount * 100) > refundableCents) return null;

    const [refundRecord] = await transaction
      .insert(transactions)
      .values(withoutTagIds(data.record))
      .returning({ id: transactions.id });
    const refund = refundRecord as { id: string };
    if (data.record.tagIds?.length)
      await replaceTransactionTags(transaction, refund.id, data.userId, data.record.tagIds);
    if (data.splits.length > 1) {
      await transaction.insert(transactionSplits).values(
        data.splits.map((split) => ({
          userId: data.userId,
          transactionId: refund.id,
          personId: split.personId,
          amount: split.amount.toFixed(2),
        })),
      );
    }
    await transaction.insert(transactionRefunds).values({
      userId: data.userId,
      sourceTransactionId: data.sourceTransactionId,
      refundTransactionId: refund.id,
      amount: data.amount.toFixed(2),
    });
    return refund.id;
  });

  return refundId ? findTransactionByIdForUser(refundId, data.userId) : null;
}

export async function listImportedExternalIdsForUser(
  userId: string,
  sourceFingerprint: string,
  externalIds: string[],
) {
  if (!externalIds.length) return [];

  const rows = await db
    .select({ externalId: transactions.importExternalId })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.importSourceFingerprint, sourceFingerprint),
        inArray(transactions.importExternalId, externalIds),
      ),
    );

  return rows.map((row) => row.externalId as string);
}

export async function listImportCategoryMappingsForUser(userId: string, descriptionKeys: string[]) {
  if (!descriptionKeys.length) return [];

  return db
    .select({
      descriptionKey: importCategoryMappings.descriptionKey,
      categoryId: importCategoryMappings.categoryId,
      categoryType: categories.type,
    })
    .from(importCategoryMappings)
    .innerJoin(
      categories,
      and(eq(importCategoryMappings.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .where(
      and(
        eq(importCategoryMappings.userId, userId),
        inArray(importCategoryMappings.descriptionKey, descriptionKeys),
      ),
    );
}

export async function insertImportedTransactions(
  data: TransactionCreateRecord[],
  mappings: { userId: string; descriptionKey: string; categoryId: string }[],
) {
  if (!data.length) return [];

  return db.transaction(async (databaseTransaction) => {
    const inserted = await databaseTransaction
      .insert(transactions)
      .values(data)
      .onConflictDoNothing()
      .returning({ id: transactions.id });

    if (mappings.length) {
      await databaseTransaction
        .insert(importCategoryMappings)
        .values(mappings)
        .onConflictDoUpdate({
          target: [importCategoryMappings.userId, importCategoryMappings.descriptionKey],
          set: { categoryId: sql`excluded.category_id`, updatedAt: new Date() },
        });
    }

    return inserted;
  });
}

export async function deleteTransactionImportBatchForUser(batchId: string, userId: string) {
  return db
    .delete(transactions)
    .where(and(eq(transactions.importBatchId, batchId), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });
}

export async function insertTransactionsWithSplits(
  data: TransactionCreateRecord[],
  splits: Array<{ transactionIndex: number; personId: string; amount: string }>,
  confirmation?: TransactionConfirmation,
) {
  if (!data.length) return [];

  let insertedRows: Array<{ id: string }>;
  try {
    insertedRows = await db.transaction(async (transaction) => {
      const rows = await transaction
        .insert(transactions)
        .values(
          data.map((record) => ({
            ...withoutTagIds(record),
            settledAmount: record.settledDate && record.isSettled ? record.amount : null,
          })),
        )
        .returning({ id: transactions.id });
      for (const [index, row] of rows.entries()) {
        const record = data[index];
        if (record?.settledDate && record.isSettled)
          await transaction.insert(settlementEvents).values({
            userId: record.userId,
            transactionId: row.id,
            action: "confirm",
            snapshot: {
              before: { accountId: record.accountId, amount: null, date: null },
              after: {
                amount: record.amount,
                settledDate: record.settledDate.toISOString().slice(0, 10),
              },
              expectedAmount: record.amount,
            },
          });
        if (record?.tagIds?.length)
          await replaceTransactionTags(transaction, row.id, record.userId, record.tagIds);
      }
      const splitRows = splits.flatMap((split) => {
        const row = rows[split.transactionIndex];
        return row
          ? [
              {
                userId: (data[split.transactionIndex] as TransactionCreateRecord).userId,
                transactionId: row.id,
                personId: split.personId,
                amount: split.amount,
                settledAmount:
                  data[split.transactionIndex]?.settledDate &&
                  data[split.transactionIndex]?.isSettled
                    ? split.amount
                    : null,
              },
            ]
          : [];
      });
      if (splitRows.length) await transaction.insert(transactionSplits).values(splitRows);
      await synchronizePendingExternalExpensesForTransactions(
        transaction,
        data[0].userId,
        rows.map((row) => row.id),
        "all",
      );
      await confirmTransactionSource(transaction, confirmation, rows[0]?.id);
      return rows;
    });
  } catch (error) {
    if (error === transactionConfirmationConflict) return [];
    throw error;
  }

  return Promise.all(insertedRows.map((row) => findTransactionByIdForUser(row.id, data[0].userId)));
}

export async function insertTransferWithBalanceCheck(
  data: [TransactionCreateRecord, TransactionCreateRecord],
  currentPeriod: string,
  balanceSnapshot: { displayed: number; persisted: number },
  confirmation?: TransactionConfirmation,
) {
  const outgoingIndex = data.findIndex((record) => Number(record.amount) < 0);
  const outgoing = data[outgoingIndex];
  if (!outgoing?.accountId) return [];
  const sourceAccountId = outgoing.accountId;

  let insertedRows: Array<{ id: string }>;
  try {
    insertedRows = await db.transaction(async (transaction) => {
      await lockTransferSourceAccounts(transaction, outgoing.userId, [sourceAccountId]);
      if (outgoing.isSettled) {
        await assertSufficientTransferBalance(transaction, {
          userId: outgoing.userId,
          sourceAccountId,
          amount: Math.abs(Number(outgoing.amount)),
          balanceSnapshot,
          period: currentPeriod,
        });
      }

      const rows = await transaction
        .insert(transactions)
        .values(data.map(withoutTagIds))
        .returning({ id: transactions.id });
      for (const [index, row] of rows.entries()) {
        const record = data[index];
        if (record?.tagIds?.length)
          await replaceTransactionTags(transaction, row.id, record.userId, record.tagIds);
      }
      await confirmTransactionSource(transaction, confirmation, rows[outgoingIndex]?.id);
      return rows;
    });
  } catch (error) {
    if (error === transactionConfirmationConflict) return [];
    throw error;
  }

  return Promise.all(
    insertedRows.map((row) => findTransactionByIdForUser(row.id, outgoing.userId)),
  );
}

export async function insertInstallmentSeriesWithTransactions(
  series: InstallmentSeriesCreateRecord,
  data: TransactionCreateRecord[],
  splits: Array<{ transactionIndex: number; personId: string; amount: string }>,
  confirmation?: TransactionConfirmation,
) {
  if (!data.length) return [];

  let insertedRows: Array<{ id: string }>;
  try {
    insertedRows = await db.transaction(async (transaction) => {
      await transaction.insert(installmentSeries).values(series);
      const rows = await transaction
        .insert(transactions)
        .values(data.map(withoutTagIds))
        .returning({ id: transactions.id });
      for (const [index, row] of rows.entries()) {
        const record = data[index];
        if (record?.tagIds?.length)
          await replaceTransactionTags(transaction, row.id, record.userId, record.tagIds);
      }
      const splitRows = splits.flatMap((split) => {
        const row = rows[split.transactionIndex];
        return row
          ? [
              {
                userId: (data[split.transactionIndex] as TransactionCreateRecord).userId,
                transactionId: row.id,
                personId: split.personId,
                amount: split.amount,
              },
            ]
          : [];
      });
      if (splitRows.length) await transaction.insert(transactionSplits).values(splitRows);
      await synchronizePendingExternalExpensesForTransactions(
        transaction,
        series.userId,
        rows.map((row) => row.id),
        "all",
      );
      await confirmTransactionSource(transaction, confirmation, rows[0]?.id);
      return rows;
    });
  } catch (error) {
    if (error === transactionConfirmationConflict) return [];
    throw error;
  }

  return Promise.all(insertedRows.map((row) => findTransactionByIdForUser(row.id, series.userId)));
}

export async function insertRecurringRuleWithSplits(
  data: RecurringRuleCreateRecord,
  splits: Array<{ personId: string; amount: string }>,
) {
  const ruleId = await db.transaction(async (transaction) => {
    const [seriesRecord] = await transaction
      .insert(recurringTransactionSeries)
      .values({ userId: data.userId })
      .returning({ id: recurringTransactionSeries.id });
    const series = seriesRecord as { id: string };
    const [ruleRecord] = await transaction
      .insert(recurringTransactionRules)
      .values({ ...withoutTagIds(data), seriesId: series.id })
      .returning({ id: recurringTransactionRules.id });
    const rule = ruleRecord as { id: string };
    if (data.tagIds?.length)
      await replaceRecurringRuleTags(transaction, rule.id, data.userId, data.tagIds);
    if (splits.length) {
      await transaction
        .insert(recurringTransactionSplits)
        .values(
          splits.map((split) => ({ ...split, userId: data.userId, recurringRuleId: rule.id })),
        );
    }
    return rule.id;
  });

  return findRecurringRuleByIdForUser(ruleId, data.userId);
}

export async function listTransactionSplitsForUser(transactionIds: string[], userId: string) {
  if (!transactionIds.length) return [];
  return db
    .select({
      transactionId: transactionSplits.transactionId,
      personId: transactionSplits.personId,
      personName: people.name,
      personAvatarUrl: people.avatarUrl,
      amount: effectiveSplitAmountSql.as("amount"),
      plannedAmount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .innerJoin(people, and(eq(transactionSplits.personId, people.id), eq(people.userId, userId)))
    .where(
      and(
        eq(transactionSplits.userId, userId),
        inArray(transactionSplits.transactionId, transactionIds),
      ),
    );
}

export async function listRecurringSplitsForUser(ruleIds: string[], userId: string) {
  if (!ruleIds.length) return [];
  return db
    .select({
      recurringRuleId: recurringTransactionSplits.recurringRuleId,
      personId: recurringTransactionSplits.personId,
      personName: people.name,
      personAvatarUrl: people.avatarUrl,
      amount: recurringTransactionSplits.amount,
    })
    .from(recurringTransactionSplits)
    .innerJoin(
      people,
      and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, userId)),
    )
    .where(
      and(
        eq(recurringTransactionSplits.userId, userId),
        inArray(recurringTransactionSplits.recurringRuleId, ruleIds),
      ),
    );
}

export async function listRecurringOccurrencesForUser(
  seriesIds: string[],
  periodStart: Date,
  periodEnd: Date,
  userId: string,
) {
  if (!seriesIds.length) return [];
  return db
    .select({
      recurringRuleId: recurringTransactionOccurrences.recurringRuleId,
      recurringSeriesId: recurringTransactionOccurrences.recurringSeriesId,
      purchaseDate: recurringTransactionOccurrences.purchaseDate,
      isSettled: recurringTransactionOccurrences.isSettled,
      dueDateRuleExcluded: recurringTransactionOccurrences.dueDateRuleExcluded,
      frozenDueDate: recurringTransactionOccurrences.frozenDueDate,
      dueDateAdjustment: recurringTransactionOccurrences.dueDateAdjustment,
      accountId: recurringTransactionOccurrences.accountId,
      accountName: occurrenceAccounts.name,
      accountLogo: occurrenceAccounts.logo,
      boletoPaymentDate: recurringTransactionOccurrences.boletoPaymentDate,
      settledDate: recurringTransactionOccurrences.settledDate,
      settledAmount: recurringTransactionOccurrences.settledAmount,
      settledAllocations: recurringTransactionOccurrences.settledAllocations,
    })
    .from(recurringTransactionOccurrences)
    .leftJoin(
      occurrenceAccounts,
      and(
        eq(recurringTransactionOccurrences.accountId, occurrenceAccounts.id),
        eq(occurrenceAccounts.userId, userId),
      ),
    )
    .where(
      and(
        eq(recurringTransactionOccurrences.userId, userId),
        inArray(recurringTransactionOccurrences.recurringSeriesId, seriesIds),
        gte(recurringTransactionOccurrences.purchaseDate, periodStart),
        lte(recurringTransactionOccurrences.purchaseDate, periodEnd),
      ),
    );
}

export async function listSettledRecurringBoletoOccurrencesByPaymentDateForUser(
  userId: string,
  accountId: string,
  dateStart: Date,
  dateEnd: Date,
) {
  return db
    .select({
      recurringRuleId: recurringTransactionOccurrences.recurringRuleId,
      recurringSeriesId: recurringTransactionOccurrences.recurringSeriesId,
      purchaseDate: recurringTransactionOccurrences.purchaseDate,
      isSettled: recurringTransactionOccurrences.isSettled,
      dueDateRuleExcluded: recurringTransactionOccurrences.dueDateRuleExcluded,
      frozenDueDate: recurringTransactionOccurrences.frozenDueDate,
      dueDateAdjustment: recurringTransactionOccurrences.dueDateAdjustment,
      accountId: recurringTransactionOccurrences.accountId,
      accountName: occurrenceAccounts.name,
      accountLogo: occurrenceAccounts.logo,
      boletoPaymentDate: recurringTransactionOccurrences.boletoPaymentDate,
      settledDate: recurringTransactionOccurrences.settledDate,
      settledAmount: recurringTransactionOccurrences.settledAmount,
      settledAllocations: recurringTransactionOccurrences.settledAllocations,
    })
    .from(recurringTransactionOccurrences)
    .innerJoin(
      recurringTransactionRules,
      and(
        eq(recurringTransactionOccurrences.recurringRuleId, recurringTransactionRules.id),
        eq(recurringTransactionRules.userId, userId),
        eq(recurringTransactionRules.status, "active"),
      ),
    )
    .leftJoin(
      occurrenceAccounts,
      and(
        eq(recurringTransactionOccurrences.accountId, occurrenceAccounts.id),
        eq(occurrenceAccounts.userId, userId),
      ),
    )
    .where(
      and(
        eq(recurringTransactionOccurrences.userId, userId),
        eq(recurringTransactionOccurrences.isSettled, true),
        or(
          eq(recurringTransactionOccurrences.accountId, accountId),
          and(
            isNull(recurringTransactionOccurrences.accountId),
            eq(recurringTransactionRules.accountId, accountId),
          ),
        ),
        sql`coalesce(${recurringTransactionOccurrences.settledDate}, ${recurringTransactionOccurrences.boletoPaymentDate}) >= ${dateStart}`,
        sql`coalesce(${recurringTransactionOccurrences.settledDate}, ${recurringTransactionOccurrences.boletoPaymentDate}) <= ${dateEnd}`,
      ),
    );
}

export async function settleRecurringOccurrenceForUser(
  recurringRuleId: string,
  purchaseDate: Date,
  userId: string,
  isSettled: boolean,
  settledDate: Date | null,
  accountId?: string,
  amount?: number,
) {
  return settleRecurringTransaction({
    id: recurringRuleId,
    purchaseDate,
    userId,
    isSettled,
    date: settledDate ?? new Date(),
    accountId,
    amount,
  });
}

export async function listPaidInvoicePeriodsForUser(
  cardId: string,
  periods: string[],
  userId: string,
) {
  if (!periods.length) return [];
  return db
    .select({ period: invoices.period })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.cardId, cardId),
        eq(invoices.paymentStatus, "paid"),
        inArray(invoices.period, periods),
      ),
    );
}

export async function getCardExpenseTotalForUser(cardId: string, userId: string) {
  const [result] = await db
    .select({
      total: sql<string>`greatest(-coalesce(sum(${effectiveTransactionAmountSql}), 0), 0)`,
    })
    .from(transactions)
    .leftJoin(
      invoices,
      and(
        eq(invoices.userId, userId),
        eq(invoices.cardId, transactions.cardId),
        eq(invoices.period, transactions.period),
      ),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.cardId, cardId),
        or(isNull(invoices.paymentStatus), eq(invoices.paymentStatus, "pending")),
      ),
    );
  return Number((result as { total: string }).total);
}

export async function copyTransactionAttachmentLinksForUser(
  sourceId: string,
  targetId: string,
  userId: string,
) {
  await db.transaction(async (transaction) => {
    const transactionIds = [...new Set([sourceId, targetId])];
    const ownedTransactions = await transaction
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));
    if (ownedTransactions.length !== transactionIds.length || sourceId === targetId) return;

    const readyAttachments = await transaction
      .select({ attachmentId: attachments.id })
      .from(transactionAttachments)
      .innerJoin(
        attachments,
        and(
          eq(transactionAttachments.attachmentId, attachments.id),
          eq(attachments.userId, userId),
        ),
      )
      .where(
        and(
          eq(transactionAttachments.transactionId, sourceId),
          eq(transactionAttachments.userId, userId),
          notLike(attachments.fileKey, "pending/%"),
          notLike(attachments.fileKey, "deleting/%"),
        ),
      )
      .orderBy(asc(attachments.id))
      .for("update", { of: attachments });
    if (!readyAttachments.length) return;

    await transaction
      .insert(transactionAttachments)
      .values(
        readyAttachments.map(({ attachmentId }) => ({
          userId,
          transactionId: targetId,
          attachmentId,
        })),
      )
      .onConflictDoNothing();
  });
}

export async function listTransactionIdsWithAttachmentsForUser(
  transactionIds: string[],
  userId: string,
) {
  if (!transactionIds.length) return [];
  return db
    .selectDistinct({ transactionId: transactionAttachments.transactionId })
    .from(transactionAttachments)
    .where(
      and(
        eq(transactionAttachments.userId, userId),
        inArray(transactionAttachments.transactionId, transactionIds),
      ),
    );
}

export async function listTransactionsByPeriod(
  userId: string,
  period: string,
  filters: PersistedTransactionFilters = {},
) {
  return listPersistedTransactions(userId, [
    eq(transactions.period, period),
    ...buildPersistedTransactionFilters(userId, filters),
  ]);
}

export async function listTransactionsByDueDateRange(
  userId: string,
  from: string,
  through: string,
) {
  return listPersistedTransactions(userId, [
    eq(transactions.type, "expense"),
    gte(transactions.dueDate, new Date(`${from}T00:00:00.000Z`)),
    lte(transactions.dueDate, new Date(`${through}T00:00:00.000Z`)),
  ]);
}

export async function listAccountStatementTransactionsForUser(
  userId: string,
  _period: string,
  dateStart: Date,
  dateEnd: Date,
  _hasDateFilter: boolean,
  filters: PersistedTransactionFilters,
) {
  const effectiveDate = sql<string>`coalesce(${transactions.settledDate}, case when ${transactions.paymentMethod} = 'boleto' then coalesce(${transactions.boletoPaymentDate}, ${transactions.dueDate}, ${transactions.purchaseDate}) else ${transactions.purchaseDate} end)`;
  const startDate = dateStart.toISOString().slice(0, 10);
  const endDate = dateEnd.toISOString().slice(0, 10);
  return listPersistedTransactions(userId, [
    eq(transactions.isSettled, true),
    gte(effectiveDate, startDate),
    lte(effectiveDate, endDate),
    ...buildPersistedTransactionFilters(userId, filters),
  ]);
}

async function listPersistedTransactions(userId: string, filters: SQL[]) {
  return db
    .select(transactionColumns)
    .from(transactions)
    .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
    .leftJoin(
      transactionAccounts,
      and(
        eq(transactions.accountId, transactionAccounts.id),
        eq(transactionAccounts.userId, userId),
      ),
    )
    .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
    .leftJoin(
      categories,
      and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .leftJoin(
      sourceAccounts,
      and(eq(transactions.sourceAccountId, sourceAccounts.id), eq(sourceAccounts.userId, userId)),
    )
    .leftJoin(
      destinationAccounts,
      and(
        eq(transactions.destinationAccountId, destinationAccounts.id),
        eq(destinationAccounts.userId, userId),
      ),
    )
    .where(and(eq(transactions.userId, userId), ...filters))
    .orderBy(desc(transactions.purchaseDate), desc(transactions.createdAt), desc(transactions.id));
}

export async function listTransactionsByPurchaseDateRange(
  userId: string,
  dateStart?: Date,
  dateEnd?: Date,
  filters: PersistedTransactionFilters = {},
) {
  const dateConditions = [
    eq(transactions.userId, userId),
    ...(dateStart ? [gte(transactions.purchaseDate, dateStart)] : []),
    ...(dateEnd ? [lte(transactions.purchaseDate, dateEnd)] : []),
    ...buildPersistedTransactionFilters(userId, filters),
  ];

  return db
    .select(transactionColumns)
    .from(transactions)
    .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
    .leftJoin(
      transactionAccounts,
      and(
        eq(transactions.accountId, transactionAccounts.id),
        eq(transactionAccounts.userId, userId),
      ),
    )
    .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
    .leftJoin(
      categories,
      and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .leftJoin(
      sourceAccounts,
      and(eq(transactions.sourceAccountId, sourceAccounts.id), eq(sourceAccounts.userId, userId)),
    )
    .leftJoin(
      destinationAccounts,
      and(
        eq(transactions.destinationAccountId, destinationAccounts.id),
        eq(destinationAccounts.userId, userId),
      ),
    )
    .where(and(...dateConditions))
    .orderBy(desc(transactions.purchaseDate), desc(transactions.createdAt), desc(transactions.id));
}

function buildPersistedTransactionFilters(userId: string, filters: PersistedTransactionFilters) {
  const splitForPerson = filters.personIds?.length
    ? db
        .select({ id: transactionSplits.id })
        .from(transactionSplits)
        .where(
          and(
            eq(transactionSplits.userId, userId),
            eq(transactionSplits.transactionId, transactions.id),
            inArray(transactionSplits.personId, filters.personIds),
          ),
        )
    : null;
  const splitExists =
    filters.isDivided || splitForPerson
      ? db
          .select({ id: transactionSplits.id })
          .from(transactionSplits)
          .where(
            and(
              eq(transactionSplits.userId, userId),
              eq(transactionSplits.transactionId, transactions.id),
            ),
          )
      : null;
  const attachmentExists = filters.hasAttachments
    ? db
        .select({ transactionId: transactionAttachments.transactionId })
        .from(transactionAttachments)
        .where(
          and(
            eq(transactionAttachments.userId, userId),
            eq(transactionAttachments.transactionId, transactions.id),
          ),
        )
    : null;

  const conditions: Array<SQL | undefined> = [
    filters.type ? eq(transactions.type, filters.type) : undefined,
    filters.condition ? eq(transactions.condition, filters.condition) : undefined,
    filters.paymentMethod ? eq(transactions.paymentMethod, filters.paymentMethod) : undefined,
    filters.personIds?.length
      ? or(
          inArray(transactions.personId, filters.personIds),
          exists(splitForPerson as NonNullable<typeof splitForPerson>),
        )
      : undefined,
    filters.categoryIds?.length ? inArray(transactions.categoryId, filters.categoryIds) : undefined,
    filters.accountIds?.length
      ? or(
          inArray(transactions.accountId, filters.accountIds),
          inArray(transactions.sourceAccountId, filters.accountIds),
          inArray(transactions.destinationAccountId, filters.accountIds),
        )
      : undefined,
    filters.cardIds?.length ? inArray(transactions.cardId, filters.cardIds) : undefined,
    filters.minAmount !== undefined
      ? sql`abs(${effectiveTransactionAmountSql}) >= ${filters.minAmount}`
      : undefined,
    filters.maxAmount !== undefined
      ? sql`abs(${effectiveTransactionAmountSql}) <= ${filters.maxAmount}`
      : undefined,
    filters.hasAttachments && attachmentExists ? exists(attachmentExists) : undefined,
    filters.hasDueDate ? isNotNull(transactions.dueDate) : undefined,
    filters.isDivided && splitExists ? exists(splitExists) : undefined,
  ];

  return conditions.filter((condition): condition is SQL => condition !== undefined);
}

export async function listRecentEstablishmentNamesForUser(
  userId: string,
  dateStart: Date,
  dateEnd: Date,
  limit: number,
) {
  // The aggregate keeps the latest spelling while grouping names case-insensitively.
  const normalizedName = sql<string>`lower(trim(${transactions.name}))`;
  const latestName = sql<string>`(
    array_agg(trim(${transactions.name}) order by ${transactions.purchaseDate} desc, ${transactions.createdAt} desc)
  )[1]`;
  const latestPurchaseDate = sql<Date>`max(${transactions.purchaseDate})`;

  return db
    .select({ name: latestName })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        inArray(transactions.origin, ["regular", "refund"]),
        gte(transactions.purchaseDate, dateStart),
        lte(transactions.purchaseDate, dateEnd),
        sql`trim(${transactions.name}) <> ''`,
      ),
    )
    .groupBy(normalizedName)
    .orderBy(desc(latestPurchaseDate), asc(normalizedName))
    .limit(limit);
}

function selectRecurringRulesForUser(userId: string) {
  return db
    .select(recurringRuleColumns)
    .from(recurringTransactionRules)
    .innerJoin(
      people,
      and(eq(recurringTransactionRules.personId, people.id), eq(people.userId, userId)),
    )
    .leftJoin(
      transactionAccounts,
      and(
        eq(recurringTransactionRules.accountId, transactionAccounts.id),
        eq(transactionAccounts.userId, userId),
      ),
    )
    .leftJoin(cards, and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)))
    .leftJoin(
      categories,
      and(eq(recurringTransactionRules.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .leftJoin(
      sourceAccounts,
      and(
        eq(recurringTransactionRules.sourceAccountId, sourceAccounts.id),
        eq(sourceAccounts.userId, userId),
      ),
    )
    .leftJoin(
      destinationAccounts,
      and(
        eq(recurringTransactionRules.destinationAccountId, destinationAccounts.id),
        eq(destinationAccounts.userId, userId),
      ),
    );
}

export async function listRecurringRulesForPeriod(userId: string, periodEnd: Date) {
  return selectRecurringRulesForUser(userId).where(
    and(
      eq(recurringTransactionRules.userId, userId),
      eq(recurringTransactionRules.status, "active"),
      lte(recurringTransactionRules.startDate, new Date(periodEnd.getTime() + 32 * 86_400_000)),
    ),
  );
}

export async function listRecurringRulesByIdsForUser(userId: string, ruleIds: string[]) {
  if (!ruleIds.length) return [];
  return selectRecurringRulesForUser(userId).where(
    and(
      eq(recurringTransactionRules.userId, userId),
      inArray(recurringTransactionRules.id, ruleIds),
    ),
  );
}

export async function findTransactionByIdForUser(id: string, userId: string) {
  const [transaction] = await db
    .select(transactionColumns)
    .from(transactions)
    .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
    .leftJoin(
      transactionAccounts,
      and(
        eq(transactions.accountId, transactionAccounts.id),
        eq(transactionAccounts.userId, userId),
      ),
    )
    .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
    .leftJoin(
      categories,
      and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .leftJoin(
      sourceAccounts,
      and(eq(transactions.sourceAccountId, sourceAccounts.id), eq(sourceAccounts.userId, userId)),
    )
    .leftJoin(
      destinationAccounts,
      and(
        eq(transactions.destinationAccountId, destinationAccounts.id),
        eq(destinationAccounts.userId, userId),
      ),
    )
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);

  return transaction ?? null;
}

export async function findRecurringRuleByIdForUser(id: string, userId: string) {
  const [rule] = await db
    .select(recurringRuleColumns)
    .from(recurringTransactionRules)
    .innerJoin(
      people,
      and(eq(recurringTransactionRules.personId, people.id), eq(people.userId, userId)),
    )
    .leftJoin(
      transactionAccounts,
      and(
        eq(recurringTransactionRules.accountId, transactionAccounts.id),
        eq(transactionAccounts.userId, userId),
      ),
    )
    .leftJoin(cards, and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)))
    .leftJoin(
      categories,
      and(eq(recurringTransactionRules.categoryId, categories.id), eq(categories.userId, userId)),
    )
    .leftJoin(
      sourceAccounts,
      and(
        eq(recurringTransactionRules.sourceAccountId, sourceAccounts.id),
        eq(sourceAccounts.userId, userId),
      ),
    )
    .leftJoin(
      destinationAccounts,
      and(
        eq(recurringTransactionRules.destinationAccountId, destinationAccounts.id),
        eq(destinationAccounts.userId, userId),
      ),
    )
    .where(and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)))
    .limit(1);

  return rule ?? null;
}

export async function listRecurringRulesBySeriesForUser(seriesId: string, userId: string) {
  return db
    .select({
      id: recurringTransactionRules.id,
      startDate: recurringTransactionRules.startDate,
      updatedAt: recurringTransactionRules.updatedAt,
    })
    .from(recurringTransactionRules)
    .where(
      and(
        eq(recurringTransactionRules.seriesId, seriesId),
        eq(recurringTransactionRules.userId, userId),
      ),
    )
    .orderBy(asc(recurringTransactionRules.startDate));
}

export async function updateTransactionWithSplitsForUser(
  id: string,
  userId: string,
  data: TransactionUpdateRecord,
  splits?: Array<{ personId: string; amount: string }>,
) {
  const updatedId = await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
      .for("update");
    if (!current) return null;
    const financialKeys = [
      "amount",
      "type",
      "condition",
      "paymentMethod",
      "purchaseDate",
      "personId",
      "accountId",
      "cardId",
      "dueDate",
      "dueDateRuleExcluded",
      "isSettled",
      "settledDate",
    ] as const;
    if (
      current.settledDate &&
      (splits !== undefined ||
        financialKeys.some(
          (key) =>
            data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(current[key]),
        ))
    )
      throw new SettlementError("SETTLEMENT_REQUIRES_UNDO");
    const beforeAssignments = await findExternalExpenseAssignmentKeys(transaction, userId, [id]);
    const [row] = await transaction
      .update(transactions)
      .set({ ...withoutTagIds(data), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    if (!row) return null;
    if (data.tagIds !== undefined)
      await replaceTransactionTags(transaction, id, userId, data.tagIds);
    if (splits !== undefined) {
      await replaceTransactionSplits(transaction, id, userId, splits);
    }
    const afterAssignments = await findExternalExpenseAssignmentKeys(transaction, userId, [id]);
    await synchronizePendingExternalExpensesForTransactions(
      transaction,
      userId,
      [id],
      selectNewExternalExpenseAssignmentKeys(beforeAssignments, afterAssignments),
    );
    return row.id;
  });

  return updatedId ? findTransactionByIdForUser(updatedId, userId) : null;
}

export async function updateTransferPairForUser(
  transferId: string,
  userId: string,
  outgoing: TransactionUpdateRecord,
  incoming: TransactionUpdateRecord,
  currentPeriod: string,
  balanceSnapshot: { displayed: number; persisted: number },
) {
  const outgoingId = await db.transaction(async (transaction) => {
    const existingRows = await transaction
      .select({ accountId: transactions.accountId })
      .from(transactions)
      .where(and(eq(transactions.transferId, transferId), eq(transactions.userId, userId)));
    await lockTransferSourceAccounts(transaction, userId, [
      ...existingRows.map((row) => row.accountId),
      outgoing.accountId,
    ]);

    const rows = await transaction
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        amount: effectiveTransactionAmountSql.as("amount"),
        isSettled: transactions.isSettled,
        period: transactions.period,
      })
      .from(transactions)
      .where(and(eq(transactions.transferId, transferId), eq(transactions.userId, userId)))
      .for("update");
    const outgoingRow = rows.find((row) => Number(row.amount) < 0);
    const incomingRow = rows.find((row) => Number(row.amount) > 0);
    if (!outgoingRow || !incomingRow || rows.length !== 2) return null;

    if (outgoing.isSettled && outgoing.accountId) {
      const replacedPostingEffect = rows.reduce(
        (total, row) =>
          row.isSettled && row.accountId === outgoing.accountId && row.period <= currentPeriod
            ? total + Number(row.amount)
            : total,
        0,
      );
      await assertSufficientTransferBalance(transaction, {
        userId,
        sourceAccountId: outgoing.accountId,
        amount: Math.abs(Number(outgoing.amount)),
        balanceSnapshot,
        period: currentPeriod,
        replacedPostingEffect,
      });
    }

    await transaction
      .update(transactions)
      .set({ ...withoutTagIds(outgoing), updatedAt: new Date() })
      .where(and(eq(transactions.id, outgoingRow.id), eq(transactions.userId, userId)));
    await transaction
      .update(transactions)
      .set({ ...withoutTagIds(incoming), updatedAt: new Date() })
      .where(and(eq(transactions.id, incomingRow.id), eq(transactions.userId, userId)));
    if (outgoing.tagIds !== undefined)
      await replaceTransactionTags(transaction, outgoingRow.id, userId, outgoing.tagIds);
    if (incoming.tagIds !== undefined)
      await replaceTransactionTags(transaction, incomingRow.id, userId, incoming.tagIds);
    return outgoingRow.id;
  });

  return outgoingId ? findTransactionByIdForUser(outgoingId, userId) : null;
}

export async function deleteTransactionForUser(id: string, userId: string) {
  return db.transaction(async (transaction) => {
    const [target] = await transaction
      .select({ seriesId: transactions.seriesId })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);
    await deletePendingExternalExpensesForTransactions(transaction, userId, [id]);
    const [deleted] = await transaction
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    if (deleted && target?.seriesId) {
      const remaining = await transaction
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.seriesId, target.seriesId), eq(transactions.userId, userId)));
      await synchronizePendingExternalExpensesForTransactions(
        transaction,
        userId,
        remaining.map((item) => item.id),
        new Set(),
      );
    }
    return deleted ?? null;
  });
}

export async function deleteTransferPairForUser(transferId: string, userId: string) {
  return db
    .delete(transactions)
    .where(and(eq(transactions.transferId, transferId), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });
}

export function listBulkTransactionTargetsForUser(ids: string[], userId: string) {
  if (!ids.length) return Promise.resolve([]);
  return db
    .select({
      id: transactions.id,
      origin: transactions.origin,
      type: transactions.type,
      paymentMethod: transactions.paymentMethod,
      cardId: transactions.cardId,
      isSettled: transactions.isSettled,
      refundedAmount: transactionColumns.refundedAmount,
      tagIds: transactionColumns.tagIds,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
}

export async function updateTransactionsCategoryForUser(
  ids: string[],
  userId: string,
  categoryId: string,
) {
  return db.transaction(async (transaction) => {
    const beforeAssignments = await findExternalExpenseAssignmentKeys(transaction, userId, ids);
    const updated = await transaction
      .update(transactions)
      .set({ categoryId, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.id, ids),
          eq(transactions.origin, "regular"),
        ),
      )
      .returning({ id: transactions.id });
    const updatedIds = updated.map((item) => item.id);
    const afterAssignments = await findExternalExpenseAssignmentKeys(
      transaction,
      userId,
      updatedIds,
    );
    await synchronizePendingExternalExpensesForTransactions(
      transaction,
      userId,
      updatedIds,
      selectNewExternalExpenseAssignmentKeys(beforeAssignments, afterAssignments),
    );
    return updatedIds;
  });
}

export async function renameTransactionsForUser(
  items: Array<{ id: string; name: string }>,
  userId: string,
) {
  return db.transaction(async (transaction) => {
    const renamed: string[] = [];
    for (const item of items) {
      const [row] = await transaction
        .update(transactions)
        .set({ name: item.name, updatedAt: new Date() })
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.id, item.id),
            eq(transactions.origin, "regular"),
          ),
        )
        .returning({ id: transactions.id });
      if (row) renamed.push(row.id);
    }
    return renamed;
  });
}

export async function addTransactionsTagsForUser(ids: string[], userId: string, tagIds: string[]) {
  await db
    .insert(transactionTags)
    .values(
      ids.flatMap((transactionId) => tagIds.map((tagId) => ({ transactionId, userId, tagId }))),
    )
    .onConflictDoNothing();
  return ids;
}

export async function removeTransactionsTagsForUser(
  ids: string[],
  userId: string,
  tagIds: string[],
) {
  await db
    .delete(transactionTags)
    .where(
      and(
        eq(transactionTags.userId, userId),
        inArray(transactionTags.transactionId, ids),
        inArray(transactionTags.tagId, tagIds),
      ),
    );
  return ids;
}

export async function deleteTransactionsForUser(ids: string[], userId: string) {
  return db.transaction(async (transaction) => {
    const targets = await transaction
      .select({ seriesId: transactions.seriesId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
    await deletePendingExternalExpensesForTransactions(transaction, userId, ids);
    const deleted = await transaction
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning({ id: transactions.id });
    const seriesIds = [
      ...new Set(targets.flatMap((target) => (target.seriesId ? [target.seriesId] : []))),
    ];
    if (seriesIds.length) {
      const remaining = await transaction
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), inArray(transactions.seriesId, seriesIds)));
      await synchronizePendingExternalExpensesForTransactions(
        transaction,
        userId,
        remaining.map((item) => item.id),
        new Set(),
      );
    }
    return deleted.map((item) => item.id);
  });
}

export function listTransactionSeriesForUser(seriesId: string, userId: string) {
  return db
    .select({
      id: transactions.id,
      amount: effectiveTransactionAmountSql.as("amount"),
      plannedAmount: transactions.amount,
      purchaseDate: transactions.purchaseDate,
      period: transactions.period,
      dueDate: transactions.dueDate,
      dueDateRuleExcluded: transactions.dueDateRuleExcluded,
      frozenDueDate: transactions.frozenDueDate,
      dueDateAdjustment: transactions.dueDateAdjustment,
      boletoPaymentDate: transactions.boletoPaymentDate,
      currentInstallment: transactions.currentInstallment,
      isSettled: transactions.isSettled,
      settledDate: transactions.settledDate,
    })
    .from(transactions)
    .where(and(eq(transactions.seriesId, seriesId), eq(transactions.userId, userId)))
    .orderBy(asc(transactions.currentInstallment));
}

export async function findInstallmentSeriesByIdForUser(id: string, userId: string) {
  const [series] = await db
    .select({ originalAmount: installmentSeries.originalAmount })
    .from(installmentSeries)
    .where(and(eq(installmentSeries.id, id), eq(installmentSeries.userId, userId)))
    .limit(1);
  return series;
}

export async function updateTransactionSeriesRangeWithSplitsForUser(
  userId: string,
  updates: Array<{
    id: string;
    data: TransactionUpdateRecord;
    splits?: Array<{ personId: string; amount: string }>;
  }>,
) {
  return db.transaction(async (transaction) => {
    const requestedIds = updates.map((update) => update.id);
    const lockedRows = await transaction
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, requestedIds)))
      .orderBy(asc(transactions.id))
      .for("update");
    const financialKeys = [
      "amount",
      "type",
      "condition",
      "paymentMethod",
      "purchaseDate",
      "personId",
      "accountId",
      "cardId",
      "dueDate",
      "dueDateRuleExcluded",
      "isSettled",
      "settledDate",
    ] as const;
    for (const update of updates) {
      const current = lockedRows.find((row) => row.id === update.id);
      if (
        current?.settledDate &&
        (update.splits !== undefined ||
          financialKeys.some(
            (key) =>
              update.data[key] !== undefined &&
              JSON.stringify(update.data[key]) !== JSON.stringify(current[key]),
          ))
      )
        throw new SettlementError("SETTLEMENT_REQUIRES_UNDO");
    }
    const beforeAssignments = await findExternalExpenseAssignmentKeys(
      transaction,
      userId,
      requestedIds,
    );
    const updatedIds: string[] = [];

    for (const update of updates) {
      const [row] = await transaction
        .update(transactions)
        .set({ ...withoutTagIds(update.data), updatedAt: new Date() })
        .where(and(eq(transactions.id, update.id), eq(transactions.userId, userId)))
        .returning({ id: transactions.id });
      if (!row) continue;
      updatedIds.push(row.id);
      if (update.data.tagIds !== undefined)
        await replaceTransactionTags(transaction, row.id, userId, update.data.tagIds);
      if (update.splits !== undefined) {
        await replaceTransactionSplits(transaction, update.id, userId, update.splits);
      }
    }

    const afterAssignments = await findExternalExpenseAssignmentKeys(
      transaction,
      userId,
      updatedIds,
    );
    await synchronizePendingExternalExpensesForTransactions(
      transaction,
      userId,
      updatedIds,
      selectNewExternalExpenseAssignmentKeys(beforeAssignments, afterAssignments),
    );

    return updatedIds;
  });
}

export async function deleteTransactionSeriesForUser(seriesId: string, userId: string) {
  return db.transaction(async (transaction) => {
    const transactionIds = await transaction
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.seriesId, seriesId), eq(transactions.userId, userId)));
    await deletePendingExternalExpensesForTransactions(
      transaction,
      userId,
      transactionIds.map((item) => item.id),
    );
    const [deletedSeries] = await transaction
      .delete(installmentSeries)
      .where(and(eq(installmentSeries.id, seriesId), eq(installmentSeries.userId, userId)))
      .returning({ id: installmentSeries.id });

    return deletedSeries ? transactionIds : [];
  });
}

export async function deleteTransactionSeriesRangeForUser(
  seriesId: string,
  fromInstallment: number,
  userId: string,
) {
  return db.transaction(async (transaction) => {
    const targets = await transaction
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.seriesId, seriesId),
          eq(transactions.userId, userId),
          gte(transactions.currentInstallment, fromInstallment),
        ),
      );
    await deletePendingExternalExpensesForTransactions(
      transaction,
      userId,
      targets.map((item) => item.id),
    );
    const deleted = await transaction
      .delete(transactions)
      .where(
        and(
          eq(transactions.seriesId, seriesId),
          eq(transactions.userId, userId),
          gte(transactions.currentInstallment, fromInstallment),
        ),
      )
      .returning({ id: transactions.id });
    const [remaining] = await transaction
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.seriesId, seriesId), eq(transactions.userId, userId)))
      .limit(1);
    if (!remaining) {
      await transaction
        .delete(installmentSeries)
        .where(and(eq(installmentSeries.id, seriesId), eq(installmentSeries.userId, userId)));
    } else {
      await synchronizePendingExternalExpensesForTransactions(
        transaction,
        userId,
        [remaining.id],
        new Set(),
      );
    }
    return deleted;
  });
}

export async function settleTransactionsForUser(
  ids: string[],
  userId: string,
  isSettled: boolean,
  currentPeriod: string,
  balanceSnapshots: Readonly<Record<string, { displayed: number; persisted: number } | undefined>>,
  boletoPaymentDate: Date,
  settledAmount?: number,
  accountId?: string,
) {
  if (!ids.length) return [];
  const targetRows = await db
    .select({ type: transactions.type })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
  if (!targetRows.some((row) => row.type === "transfer"))
    return settlePersistedTransactions({
      ids,
      userId,
      isSettled,
      date: boletoPaymentDate,
      amount: settledAmount,
      accountId,
    });
  if (settledAmount !== undefined || targetRows.some((row) => row.type !== "transfer"))
    throw new SettlementError("SETTLEMENT_UNSUPPORTED");
  return db.transaction(async (transaction) => {
    const requested = await transaction
      .select({ id: transactions.id, transferId: transactions.transferId })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.id, ids),
          isNull(transactions.cardId),
          ne(transactions.origin, "accountBalanceAdjustment"),
        ),
      );
    const transferIds = [
      ...new Set(
        requested.map((item) => item.transferId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const targets = transferIds.length
      ? or(inArray(transactions.id, ids), inArray(transactions.transferId, transferIds))
      : inArray(transactions.id, ids);
    if (isSettled && transferIds.length) {
      const transferRows = await transaction
        .select({
          accountId: transactions.accountId,
          amount: effectiveTransactionAmountSql.as("amount"),
          isSettled: transactions.isSettled,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), inArray(transactions.transferId, transferIds)));
      const sourceAccountIds = [
        ...new Set(
          transferRows.flatMap((row) =>
            row.accountId && Number(row.amount) < 0 ? [row.accountId] : [],
          ),
        ),
      ];
      await lockTransferSourceAccounts(transaction, userId, [...sourceAccountIds]);
      const lockedTransferRows = await transaction
        .select({
          accountId: transactions.accountId,
          amount: effectiveTransactionAmountSql.as("amount"),
          isSettled: transactions.isSettled,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), inArray(transactions.transferId, transferIds)))
        .for("update");
      const pendingOutgoingByAccount = new Map<string, number>();
      for (const row of lockedTransferRows) {
        if (!row.accountId || row.isSettled || Number(row.amount) >= 0) continue;
        pendingOutgoingByAccount.set(
          row.accountId,
          (pendingOutgoingByAccount.get(row.accountId) ?? 0) + Math.abs(Number(row.amount)),
        );
      }

      for (const [sourceAccountId, amount] of pendingOutgoingByAccount) {
        await assertSufficientTransferBalance(transaction, {
          userId,
          sourceAccountId,
          amount,
          balanceSnapshot: balanceSnapshots[sourceAccountId] ?? { displayed: 0, persisted: 0 },
          period: currentPeriod,
        });
      }
    }

    await transaction
      .update(transactions)
      .set({
        isSettled,
        boletoPaymentDate: isSettled
          ? sql`case when ${transactions.paymentMethod} = 'boleto' then ${boletoPaymentDate} else ${transactions.boletoPaymentDate} end`
          : null,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.userId, userId), targets, isNull(transactions.cardId)));
    return requested.map(({ id }) => ({ id }));
  });
}

export async function updateRecurringRuleWithSplitsForUser(
  id: string,
  userId: string,
  data: RecurringRuleUpdateRecord,
  splits: Array<{ personId: string; amount: string }>,
  options: {
    scope: "single" | "future" | "series";
    occurrenceDate: Date;
    previousDate: Date;
    nextDate: Date | null;
    hasPrevious: boolean;
    reschedule?: boolean;
    expectedVersions: Array<{ id: string; updatedAt: Date }>;
  },
) {
  const updatedId = await db.transaction(async (transaction) => {
    const [initial] = await transaction
      .select({ seriesId: recurringTransactionRules.seriesId })
      .from(recurringTransactionRules)
      .where(
        and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
      );
    if (!initial) return null;
    await transaction
      .select({ id: recurringTransactionSeries.id })
      .from(recurringTransactionSeries)
      .where(
        and(
          eq(recurringTransactionSeries.id, initial.seriesId),
          eq(recurringTransactionSeries.userId, userId),
        ),
      )
      .for("update");
    const [current] = await transaction
      .select()
      .from(recurringTransactionRules)
      .where(
        and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
      )
      .for("update");
    if (!current) return null;

    const series = await transaction
      .select()
      .from(recurringTransactionRules)
      .where(
        and(
          eq(recurringTransactionRules.seriesId, current.seriesId),
          eq(recurringTransactionRules.userId, userId),
        ),
      )
      .for("update");
    const expectedVersions = new Map(
      options.expectedVersions.map((version) => [version.id, version.updatedAt.getTime()]),
    );
    if (
      series.length !== expectedVersions.size ||
      series.some((rule) => expectedVersions.get(rule.id) !== rule.updatedAt.getTime())
    ) {
      return { conflict: true } as const;
    }
    const selectedVersion = series.find((rule) => rule.id === id);
    if (!selectedVersion) return null;
    const schedulePlan =
      options.reschedule && data.anchorDate
        ? planRecurringScheduleChange(
            series.map((rule) => ({
              ...rule,
              anchorDate: rule.anchorDate.toISOString().slice(0, 10),
              startDate: rule.startDate.toISOString().slice(0, 10),
              endDate: rule.endDate?.toISOString().slice(0, 10) ?? null,
              recurrenceEndDate: rule.recurrenceEndDate?.toISOString().slice(0, 10) ?? null,
              dueDate: rule.dueDate?.toISOString().slice(0, 10) ?? null,
            })),
            id,
            options.occurrenceDate.toISOString().slice(0, 10),
            data.anchorDate.toISOString().slice(0, 10),
          )
        : null;
    const boundaryDate = schedulePlan
      ? new Date(schedulePlan.boundaryDate)
      : options.occurrenceDate;
    const versionsToUpdate = selectRecurringRuleVersionsToUpdate(
      series,
      id,
      options.occurrenceDate.toISOString().slice(0, 10),
      options.scope,
    );
    const financialKeys = [
      "amount",
      "type",
      "paymentMethod",
      "personId",
      "accountId",
      "cardId",
      "dueDate",
      "dueDateRuleExcluded",

      "frequency",
      "anchorDate",
      "recurrenceEndDate",
    ] as const;
    const financialChange = financialKeys.some(
      (key) =>
        data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(current[key]),
    );
    if (financialChange) {
      const [confirmed] = await transaction
        .select({ id: recurringTransactionOccurrences.id })
        .from(recurringTransactionOccurrences)
        .where(
          and(
            eq(recurringTransactionOccurrences.userId, userId),
            eq(recurringTransactionOccurrences.recurringSeriesId, current.seriesId),
            eq(recurringTransactionOccurrences.isSettled, true),
            ...(options.scope === "series"
              ? []
              : options.scope === "single"
                ? [eq(recurringTransactionOccurrences.purchaseDate, options.occurrenceDate)]
                : [gte(recurringTransactionOccurrences.purchaseDate, boundaryDate)]),
          ),
        )
        .limit(1);
      if (confirmed) throw new SettlementError("SETTLEMENT_REQUIRES_UNDO");
    }
    const originalTagIds = await readRecurringRuleTagIds(transaction, id, userId);
    const originalSplits = await transaction
      .select({
        personId: recurringTransactionSplits.personId,
        amount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionSplits)
      .where(
        and(
          eq(recurringTransactionSplits.recurringRuleId, id),
          eq(recurringTransactionSplits.userId, userId),
        ),
      );
    const replaceSplits = async (
      ruleId: string,
      shares: Array<{ personId: string; amount: string }>,
    ) => {
      await transaction
        .delete(recurringTransactionSplits)
        .where(
          and(
            eq(recurringTransactionSplits.recurringRuleId, ruleId),
            eq(recurringTransactionSplits.userId, userId),
          ),
        );
      if (shares.length) {
        await transaction
          .insert(recurringTransactionSplits)
          .values(shares.map((share) => ({ ...share, recurringRuleId: ruleId, userId })));
      }
    };
    const insertVersion = async (
      values: RecurringRuleUpdateRecord,
      shares: Array<{ personId: string; amount: string }>,
    ) => {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...original } = current;
      const [version] = await transaction
        .insert(recurringTransactionRules)
        .values({ ...original, ...withoutTagIds(values), userId, seriesId: current.seriesId })
        .returning({ id: recurringTransactionRules.id });
      if (shares.length) {
        await transaction
          .insert(recurringTransactionSplits)
          .values(shares.map((share) => ({ ...share, recurringRuleId: version.id, userId })));
      }
      await replaceRecurringRuleTags(
        transaction,
        version.id,
        userId,
        values.tagIds ?? originalTagIds,
      );
      return version.id;
    };
    const updateExistingVersion = async (
      rule: (typeof series)[number],
      overrides: RecurringRuleUpdateRecord = {},
    ) => {
      await transaction
        .update(recurringTransactionRules)
        .set({
          ...withoutTagIds(data),
          ...overrides,
          isSettled:
            data.paymentMethod === "credit_card"
              ? null
              : rule.paymentMethod === "credit_card"
                ? false
                : rule.isSettled,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recurringTransactionRules.id, rule.id),
            eq(recurringTransactionRules.userId, userId),
          ),
        );
      await replaceSplits(rule.id, splits);
      if (data.tagIds !== undefined)
        await replaceRecurringRuleTags(transaction, rule.id, userId, data.tagIds);
    };

    if (options.scope === "series") {
      for (const rule of versionsToUpdate) {
        await updateExistingVersion(rule);
      }
      return id;
    }

    if (options.scope === "future") {
      if (schedulePlan) {
        // Old pending states refer to dates that no longer identify an occurrence.
        // Confirmed states have already been rejected under the same series lock.
        await transaction
          .delete(recurringTransactionOccurrences)
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, current.seriesId),
              gte(recurringTransactionOccurrences.purchaseDate, boundaryDate),
              eq(recurringTransactionOccurrences.isSettled, false),
            ),
          );
        for (const version of schedulePlan.previousVersionEnds) {
          await transaction
            .update(recurringTransactionRules)
            .set({ endDate: new Date(version.endDate), updatedAt: new Date() })
            .where(
              and(
                eq(recurringTransactionRules.id, version.id),
                eq(recurringTransactionRules.userId, userId),
              ),
            );
        }
      }
      const scheduledEnd = (ruleId: string): RecurringRuleUpdateRecord => {
        const version = schedulePlan?.futureVersionEnds.find((item) => item.id === ruleId);
        return version ? { endDate: version.endDate ? new Date(version.endDate) : null } : {};
      };
      const resolveScheduledVersionId = async (fallback: string) => {
        if (!schedulePlan || !data.anchorDate) return fallback;
        const [version] = await transaction
          .select({ id: recurringTransactionRules.id })
          .from(recurringTransactionRules)
          .where(
            and(
              eq(recurringTransactionRules.userId, userId),
              eq(recurringTransactionRules.seriesId, current.seriesId),
              lte(recurringTransactionRules.startDate, data.anchorDate),
              or(
                isNull(recurringTransactionRules.endDate),
                gte(recurringTransactionRules.endDate, data.anchorDate),
              ),
            ),
          );
        return version?.id ?? fallback;
      };
      if (!options.hasPrevious) {
        await updateExistingVersion(
          selectedVersion,
          schedulePlan ? { startDate: boundaryDate, ...scheduledEnd(id) } : {},
        );
        for (const rule of versionsToUpdate) {
          await updateExistingVersion(rule, scheduledEnd(rule.id));
        }
        return resolveScheduledVersionId(id);
      }
      await transaction
        .update(recurringTransactionRules)
        .set({
          endDate: schedulePlan ? new Date(schedulePlan.previousDate) : options.previousDate,
          updatedAt: new Date(),
        })
        .where(
          and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
        );
      const versionId = await insertVersion(
        { ...data, startDate: boundaryDate, ...scheduledEnd(id) },
        splits,
      );
      await transaction
        .update(recurringTransactionOccurrences)
        .set({ recurringRuleId: versionId, updatedAt: new Date() })
        .where(
          and(
            eq(recurringTransactionOccurrences.userId, userId),
            eq(recurringTransactionOccurrences.recurringRuleId, id),
            gte(recurringTransactionOccurrences.purchaseDate, options.occurrenceDate),
          ),
        );
      for (const rule of versionsToUpdate) {
        await updateExistingVersion(rule, scheduledEnd(rule.id));
      }
      return resolveScheduledVersionId(versionId);
    }

    let selectedRuleId = id;
    if (options.hasPrevious) {
      await transaction
        .update(recurringTransactionRules)
        .set({ endDate: options.previousDate, updatedAt: new Date() })
        .where(
          and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
        );
      selectedRuleId = await insertVersion(
        { ...data, startDate: options.occurrenceDate, endDate: options.occurrenceDate },
        splits,
      );
    } else {
      await transaction
        .update(recurringTransactionRules)
        .set({ ...withoutTagIds(data), endDate: options.occurrenceDate, updatedAt: new Date() })
        .where(
          and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
        );
      await replaceSplits(id, splits);
      if (data.tagIds !== undefined)
        await replaceRecurringRuleTags(transaction, id, userId, data.tagIds);
    }
    if (options.nextDate) {
      const followingRuleId = await insertVersion({ startDate: options.nextDate }, originalSplits);
      await transaction
        .update(recurringTransactionOccurrences)
        .set({ recurringRuleId: followingRuleId, updatedAt: new Date() })
        .where(
          and(
            eq(recurringTransactionOccurrences.userId, userId),
            eq(recurringTransactionOccurrences.recurringRuleId, id),
            gte(recurringTransactionOccurrences.purchaseDate, options.nextDate),
          ),
        );
    }
    await transaction
      .update(recurringTransactionOccurrences)
      .set({ recurringRuleId: selectedRuleId, updatedAt: new Date() })
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, userId),
          eq(recurringTransactionOccurrences.recurringSeriesId, current.seriesId),
          eq(recurringTransactionOccurrences.purchaseDate, options.occurrenceDate),
        ),
      );
    return selectedRuleId;
  });

  if (updatedId && typeof updatedId === "object") return updatedId;
  return updatedId ? findRecurringRuleByIdForUser(updatedId, userId) : null;
}

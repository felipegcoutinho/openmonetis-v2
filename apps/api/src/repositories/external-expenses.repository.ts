import {
  cards,
  db,
  establishmentLogos,
  externalExpenses,
  financialAccounts,
  installmentSeries,
  people,
  personConnections,
  recurringTransactionRules,
  recurringTransactionSeries,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
  user,
} from "@openmonetis/db";
import { createEstablishmentNameKey } from "@openmonetis/domain/establishments";
import {
  calculateExternalInstallmentAllocationTotal,
  calculateExternalInstallmentTotal,
  canUpdateExternalExpenseSnapshot,
  type ExternalExpenseSnapshot,
  preserveExternalExpenseInstallmentBoundary,
} from "@openmonetis/domain/external-expenses";
import { getPeriodEndDate } from "@openmonetis/domain/transactions";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  ExternalExpenseRecord,
  ExternalExpensesRepository,
} from "../services/external-expenses.service";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ownerUsers = alias(user, "external_expense_owner_users");
const sourceTransactions = alias(transactions, "external_expense_source_transactions");
const sourceCards = alias(cards, "external_expense_source_cards");
const sourceAccounts = alias(financialAccounts, "external_expense_source_accounts");
const sourceRecurringRules = alias(
  recurringTransactionRules,
  "external_expense_source_recurring_rules",
);
const sourceRecurringCards = alias(cards, "external_expense_source_recurring_cards");
const sourceRecurringAccounts = alias(
  financialAccounts,
  "external_expense_source_recurring_accounts",
);

const expenseColumns = {
  id: externalExpenses.id,
  connectionId: externalExpenses.connectionId,
  ownerUserId: externalExpenses.ownerUserId,
  recipientUserId: externalExpenses.recipientUserId,
  sourceKind: externalExpenses.sourceKind,
  sourceTransactionId: externalExpenses.sourceTransactionId,
  sourceSeriesId: externalExpenses.sourceSeriesId,
  sourceRecurringSeriesId: externalExpenses.sourceRecurringSeriesId,
  sourceRecurringRuleId: externalExpenses.sourceRecurringRuleId,
  sourceOccurrenceDate: externalExpenses.sourceOccurrenceDate,
  importedTransactionId: externalExpenses.importedTransactionId,
  ownerName: ownerUsers.name,
  ownerAvatarUrl: ownerUsers.image,
  status: externalExpenses.status,
  sourceVersion: externalExpenses.sourceVersion,
  name: externalExpenses.name,
  amount: externalExpenses.amount,
  purchaseDate: externalExpenses.purchaseDate,
  period: externalExpenses.period,
  dueDate: externalExpenses.dueDate,
  sourcePaymentMethod: externalExpenses.sourcePaymentMethod,
  sourceCondition: externalExpenses.sourceCondition,
  installmentCount: externalExpenses.installmentCount,
  currentInstallment: externalExpenses.currentInstallment,
  sourceLabel: externalExpenses.sourceLabel,
  establishmentLogoDomain: externalExpenses.establishmentLogoDomain,
  sourceLogoUrl: sql<
    string | null
  >`coalesce(${sourceCards.logo}, ${sourceAccounts.logo}, ${sourceRecurringCards.logo}, ${sourceRecurringAccounts.logo})`.as(
    "external_expense_source_logo_url",
  ),
  sourceCardBrand: sql<
    "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other" | null
  >`coalesce(${sourceCards.brand}, ${sourceRecurringCards.brand})`.as(
    "external_expense_source_card_brand",
  ),
  importedAt: externalExpenses.importedAt,
  createdAt: externalExpenses.createdAt,
  updatedAt: externalExpenses.updatedAt,
};

function expenseQuery() {
  return db
    .select(expenseColumns)
    .from(externalExpenses)
    .innerJoin(ownerUsers, eq(externalExpenses.ownerUserId, ownerUsers.id))
    .leftJoin(
      sourceTransactions,
      and(
        eq(sourceTransactions.id, externalExpenses.sourceTransactionId),
        eq(sourceTransactions.userId, externalExpenses.ownerUserId),
      ),
    )
    .leftJoin(
      sourceCards,
      and(
        eq(sourceCards.id, sourceTransactions.cardId),
        eq(sourceCards.userId, externalExpenses.ownerUserId),
      ),
    )
    .leftJoin(
      sourceAccounts,
      and(
        eq(sourceAccounts.id, sourceTransactions.accountId),
        eq(sourceAccounts.userId, externalExpenses.ownerUserId),
      ),
    )
    .leftJoin(
      sourceRecurringRules,
      and(
        eq(sourceRecurringRules.id, externalExpenses.sourceRecurringRuleId),
        eq(sourceRecurringRules.userId, externalExpenses.ownerUserId),
      ),
    )
    .leftJoin(
      sourceRecurringCards,
      and(
        eq(sourceRecurringCards.id, sourceRecurringRules.cardId),
        eq(sourceRecurringCards.userId, externalExpenses.ownerUserId),
      ),
    )
    .leftJoin(
      sourceRecurringAccounts,
      and(
        eq(sourceRecurringAccounts.id, sourceRecurringRules.accountId),
        eq(sourceRecurringAccounts.userId, externalExpenses.ownerUserId),
      ),
    );
}

async function findExpenseForRecipient(id: string, recipientUserId: string) {
  const [record] = await expenseQuery()
    .where(and(eq(externalExpenses.id, id), eq(externalExpenses.recipientUserId, recipientUserId)))
    .limit(1);
  return (record as ExternalExpenseRecord | undefined) ?? null;
}

export const externalExpensesRepository: ExternalExpensesRepository = {
  async listForRecipient(recipientUserId, query) {
    const viewFilter = eq(externalExpenses.status, query.view);
    const where = and(
      eq(externalExpenses.recipientUserId, recipientUserId),
      viewFilter,
      query.period ? eq(externalExpenses.period, query.period) : undefined,
    );
    const [records, totalRows] = await Promise.all([
      expenseQuery()
        .where(where)
        .orderBy(
          desc(externalExpenses.purchaseDate),
          desc(externalExpenses.createdAt),
          desc(externalExpenses.id),
        )
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db
        .select({
          value: count(),
          totalAmount: sql<string>`coalesce(sum(${externalExpenses.amount}), 0)`,
        })
        .from(externalExpenses)
        .where(where),
    ]);

    return {
      items: records as ExternalExpenseRecord[],
      total: Number(totalRows[0]?.value ?? 0),
      totalAmount: Number(totalRows[0]?.totalAmount ?? 0),
    };
  },

  findForRecipient: findExpenseForRecipient,

  async installmentAmountsForImport(input) {
    const [expense] = await db
      .select({
        currentInstallment: externalExpenses.currentInstallment,
        ownerUserId: externalExpenses.ownerUserId,
        sourceSeriesId: externalExpenses.sourceSeriesId,
        sourcePersonId: externalExpenses.sourcePersonId,
      })
      .from(externalExpenses)
      .where(
        and(
          eq(externalExpenses.id, input.id),
          eq(externalExpenses.recipientUserId, input.recipientUserId),
          eq(externalExpenses.status, "pending"),
          eq(externalExpenses.sourceVersion, input.expectedVersion),
          isNotNull(externalExpenses.sourceSeriesId),
        ),
      )
      .limit(1);
    if (!expense?.sourceSeriesId || expense.currentInstallment === null) return null;

    const rows = await db
      .select({
        transactionPersonId: transactions.personId,
        transactionAmount: transactions.amount,
        allocationAmount: transactionSplits.amount,
        currentInstallment: transactions.currentInstallment,
      })
      .from(transactions)
      .leftJoin(
        transactionSplits,
        and(
          eq(transactionSplits.transactionId, transactions.id),
          eq(transactionSplits.userId, expense.ownerUserId),
          eq(transactionSplits.personId, expense.sourcePersonId),
        ),
      )
      .where(
        and(
          eq(transactions.userId, expense.ownerUserId),
          eq(transactions.seriesId, expense.sourceSeriesId),
          gte(transactions.currentInstallment, expense.currentInstallment),
        ),
      )
      .orderBy(asc(transactions.currentInstallment));
    if (!rows.length) return null;

    const amounts = rows.map((row) => {
      if (row.currentInstallment === null) return null;
      if (row.allocationAmount !== null) return Math.abs(Number(row.allocationAmount));
      return row.transactionPersonId === expense.sourcePersonId
        ? Math.abs(Number(row.transactionAmount))
        : null;
    });
    return amounts.some((amount) => amount === null) ? null : (amounts as number[]);
  },

  async summaryForRecipient(recipientUserId) {
    const pendingFilter = and(
      eq(externalExpenses.recipientUserId, recipientUserId),
      eq(externalExpenses.status, "pending"),
    );
    const [aggregateRows, latestRows] = await Promise.all([
      db
        .select({
          pendingCount: count(),
          totalAmount: sql<string>`coalesce(sum(${externalExpenses.amount}), 0)`,
          counterpartCount: sql<number>`count(distinct ${externalExpenses.ownerUserId})`,
        })
        .from(externalExpenses)
        .where(pendingFilter),
      db
        .select({
          counterpartName: ownerUsers.name,
          updatedAt: externalExpenses.updatedAt,
          period: externalExpenses.period,
        })
        .from(externalExpenses)
        .innerJoin(ownerUsers, eq(externalExpenses.ownerUserId, ownerUsers.id))
        .where(pendingFilter)
        .orderBy(
          desc(externalExpenses.updatedAt),
          desc(externalExpenses.createdAt),
          desc(externalExpenses.id),
        )
        .limit(1),
    ]);
    const aggregate = aggregateRows[0];
    const latest = latestRows[0];

    return {
      pendingCount: Number(aggregate?.pendingCount ?? 0),
      totalAmount: Number(aggregate?.totalAmount ?? 0),
      counterpartCount: Number(aggregate?.counterpartCount ?? 0),
      latestCounterpartName: latest?.counterpartName ?? null,
      latestUpdatedAt: latest?.updatedAt ?? null,
      latestPeriod: latest?.period ?? null,
    };
  },

  async listRecurringSourcesForPeriod(period, ownerUserId) {
    const periodStart = new Date(`${period}-01T00:00:00.000Z`);
    const periodEnd = getPeriodEndDate(period);
    const recurringAccounts = alias(financialAccounts, "recurring_external_accounts");
    const recurringCards = alias(cards, "recurring_external_cards");
    const rows = await db
      .select({
        id: recurringTransactionRules.id,
        seriesId: recurringTransactionRules.seriesId,
        ownerUserId: recurringTransactionRules.userId,
        personId: recurringTransactionRules.personId,
        amount: recurringTransactionRules.amount,
        anchorDate: recurringTransactionRules.anchorDate,
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        seriesCreatedAt: recurringTransactionSeries.createdAt,
        name: recurringTransactionRules.name,
        dueDate: recurringTransactionRules.dueDate,
        paymentMethod: recurringTransactionRules.paymentMethod,
        accountName: recurringAccounts.name,
        cardId: recurringCards.id,
        cardName: recurringCards.name,
        cardClosingDay: recurringCards.closingDay,
        cardClosingRuleType: recurringCards.closingRuleType,
        cardClosingOffsetDays: recurringCards.closingOffsetDays,
        cardClosingOffsetMode: recurringCards.closingOffsetMode,
        cardDueDay: recurringCards.dueDay,
        splitPersonId: recurringTransactionSplits.personId,
        splitAmount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionRules)
      .innerJoin(
        recurringTransactionSeries,
        and(
          eq(recurringTransactionRules.seriesId, recurringTransactionSeries.id),
          eq(recurringTransactionRules.userId, recurringTransactionSeries.userId),
        ),
      )
      .leftJoin(
        recurringTransactionSplits,
        and(
          eq(recurringTransactionSplits.recurringRuleId, recurringTransactionRules.id),
          eq(recurringTransactionSplits.userId, recurringTransactionRules.userId),
        ),
      )
      .leftJoin(
        recurringAccounts,
        and(
          eq(recurringTransactionRules.accountId, recurringAccounts.id),
          eq(recurringTransactionRules.userId, recurringAccounts.userId),
        ),
      )
      .leftJoin(
        recurringCards,
        and(
          eq(recurringTransactionRules.cardId, recurringCards.id),
          eq(recurringTransactionRules.userId, recurringCards.userId),
        ),
      )
      .where(
        and(
          ownerUserId ? eq(recurringTransactionRules.userId, ownerUserId) : undefined,
          eq(recurringTransactionRules.type, "expense"),
          eq(recurringTransactionRules.status, "active"),
          lte(recurringTransactionRules.startDate, periodEnd),
          or(
            isNull(recurringTransactionRules.endDate),
            gte(recurringTransactionRules.endDate, periodStart),
          ),
        ),
      );
    const grouped = new Map<string, (typeof rows)[number][]>();
    for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);

    const logoDomains = await findEstablishmentLogoDomains(
      db,
      rows.map((row) => ({ name: row.name, ownerUserId: row.ownerUserId })),
    );

    return [...grouped.values()].map((group) => {
      const row = group[0] as (typeof rows)[number];
      return {
        id: row.id,
        seriesId: row.seriesId,
        ownerUserId: row.ownerUserId,
        personId: row.personId,
        amount: row.amount,
        anchorDate: toDate(row.anchorDate) as string,
        startDate: toDate(row.startDate) as string,
        endDate: toDate(row.endDate),
        frequency: row.frequency,
        splits: group.flatMap((item) =>
          item.splitPersonId && item.splitAmount !== null
            ? [{ personId: item.splitPersonId, amount: item.splitAmount }]
            : [],
        ),
        seriesCreatedAt: row.seriesCreatedAt,
        name: row.name,
        establishmentLogoDomain:
          logoDomains.get(establishmentLogoKey(row.ownerUserId, row.name)) ?? null,
        dueDate: toDate(row.dueDate),
        paymentMethod: row.paymentMethod,
        sourceLabel: row.cardName ? `Fatura ${row.cardName}` : row.accountName,
        card:
          row.cardId && row.cardClosingRuleType && row.cardDueDay
            ? {
                closingDay: row.cardClosingDay,
                closingRuleType: row.cardClosingRuleType,
                closingOffsetDays: row.cardClosingOffsetDays,
                closingOffsetMode: row.cardClosingOffsetMode,
                dueDay: row.cardDueDay,
              }
            : null,
      };
    });
  },

  async listActiveConnections(ownerUserId) {
    return db
      .select({
        id: personConnections.id,
        ownerUserId: personConnections.ownerUserId,
        personId: personConnections.personId,
        recipientUserId: personConnections.recipientUserId,
        connectedAt: personConnections.connectedAt,
      })
      .from(personConnections)
      .innerJoin(
        people,
        and(
          eq(personConnections.personId, people.id),
          eq(personConnections.ownerUserId, people.userId),
          eq(people.status, "active"),
        ),
      )
      .where(
        and(
          ownerUserId ? eq(personConnections.ownerUserId, ownerUserId) : undefined,
          eq(personConnections.status, "active"),
        ),
      );
  },

  async reconcileRecurringPeriod(input) {
    const occurrencePeriodStart = new Date(`${input.occurrencePeriod}-01T00:00:00.000Z`);
    const [occurrenceYear, occurrenceMonth] = input.occurrencePeriod.split("-").map(Number);
    const occurrencePeriodEnd = new Date(Date.UTC(occurrenceYear, occurrenceMonth, 0));
    return db.transaction(async (transaction) => {
      const existing = await transaction
        .select()
        .from(externalExpenses)
        .where(
          and(
            eq(externalExpenses.sourceKind, "recurringOccurrence"),
            isNotNull(externalExpenses.sourceRecurringSeriesId),
            isNotNull(externalExpenses.sourceOccurrenceDate),
            gte(externalExpenses.sourceOccurrenceDate, occurrencePeriodStart),
            lte(externalExpenses.sourceOccurrenceDate, occurrencePeriodEnd),
            input.ownerUserId ? eq(externalExpenses.ownerUserId, input.ownerUserId) : undefined,
          ),
        )
        .for("update");
      const draftByKey = new Map(input.drafts.map((draft) => [recurringSourceKey(draft), draft]));
      const existingByKey = new Map(
        existing.map((row) => [
          recurringSourceKey({
            ownerUserId: row.ownerUserId,
            sourceRecurringSeriesId: row.sourceRecurringSeriesId as string,
            sourceOccurrenceDate: toDate(row.sourceOccurrenceDate) as string,
            sourcePersonId: row.sourcePersonId,
          }),
          row,
        ]),
      );
      let created = 0;
      let updated = 0;
      let deleted = 0;

      for (const [key, current] of existingByKey) {
        if (current.status !== "pending" || draftByKey.has(key)) continue;
        await transaction.delete(externalExpenses).where(eq(externalExpenses.id, current.id));
        deleted += 1;
      }

      for (const [key, draft] of draftByKey) {
        const current = existingByKey.get(key);
        if (!current) {
          const inserted = await transaction
            .insert(externalExpenses)
            .values({
              connectionId: draft.connectionId,
              ownerUserId: draft.ownerUserId,
              recipientUserId: draft.recipientUserId,
              sourceKind: "recurringOccurrence",
              sourceTransactionId: null,
              sourceSeriesId: null,
              sourceRecurringSeriesId: draft.sourceRecurringSeriesId,
              sourceRecurringRuleId: draft.sourceRecurringRuleId,
              sourceOccurrenceDate: new Date(`${draft.sourceOccurrenceDate}T00:00:00.000Z`),
              sourcePersonId: draft.sourcePersonId,
              establishmentLogoDomain: draft.establishmentLogoDomain,
              ...snapshotValues(draft.snapshot),
            })
            .onConflictDoNothing()
            .returning({ id: externalExpenses.id });
          created += inserted.length;
          continue;
        }
        if (current.status !== "pending") continue;
        const unchanged =
          current.connectionId === draft.connectionId &&
          current.recipientUserId === draft.recipientUserId &&
          current.sourceRecurringRuleId === draft.sourceRecurringRuleId &&
          current.establishmentLogoDomain === draft.establishmentLogoDomain &&
          snapshotsEqual(snapshotFromRow(current), draft.snapshot);
        if (unchanged) continue;
        await transaction
          .update(externalExpenses)
          .set({
            connectionId: draft.connectionId,
            recipientUserId: draft.recipientUserId,
            sourceRecurringRuleId: draft.sourceRecurringRuleId,
            establishmentLogoDomain: draft.establishmentLogoDomain,
            sourceVersion: current.sourceVersion + 1,
            ...snapshotValues(draft.snapshot),
            updatedAt: input.changedAt,
          })
          .where(eq(externalExpenses.id, current.id));
        updated += 1;
      }

      return { created, updated, deleted };
    });
  },
};

type EligibleSourceRow = {
  transactionId: string;
  seriesId: string | null;
  seriesOriginalAmount: string | null;
  totalInstallments: number | null;
  trackedFromInstallment: number | null;
  connectionId: string;
  recipientUserId: string;
  personId: string;
  amount: string;
  transactionAmount: string;
  name: string;
  purchaseDate: Date;
  period: string;
  dueDate: Date | null;
  paymentMethod: ExternalExpenseSnapshot["paymentMethod"];
  condition: "single" | "installment";
  installmentCount: number | null;
  currentInstallment: number | null;
  cardName: string | null;
  accountName: string | null;
  allocationKind: "direct" | "split";
};

type EligibleSource = ReturnType<typeof groupEligibleSources>[number] & {
  establishmentLogoDomain: string | null;
};

export async function synchronizePendingExternalExpensesForTransactions(
  transaction: DatabaseTransaction,
  ownerUserId: string,
  transactionIds: string[],
  allowCreateKeys: ReadonlySet<string> | "all",
) {
  if (!transactionIds.length) return;

  const touched = await transaction
    .select({ id: transactions.id, seriesId: transactions.seriesId })
    .from(transactions)
    .where(and(eq(transactions.userId, ownerUserId), inArray(transactions.id, transactionIds)));
  if (!touched.length) return;

  const seriesIds = [...new Set(touched.flatMap((row) => (row.seriesId ? [row.seriesId] : [])))];
  const standaloneIds = touched.flatMap((row) => (row.seriesId ? [] : [row.id]));
  const transactionSourceFilter = transactionLogicalSourceFilter(standaloneIds, seriesIds);
  const externalSourceFilter = externalLogicalSourceFilter(standaloneIds, seriesIds);
  if (!transactionSourceFilter || !externalSourceFilter) return;

  const sourceAccountAliases = alias(financialAccounts, "external_source_accounts");
  const sourceCardAliases = alias(cards, "external_source_cards");
  const sourceColumns = {
    transactionId: transactions.id,
    seriesId: transactions.seriesId,
    seriesOriginalAmount: installmentSeries.originalAmount,
    totalInstallments: installmentSeries.totalInstallments,
    trackedFromInstallment: installmentSeries.trackedFromInstallment,
    connectionId: personConnections.id,
    recipientUserId: personConnections.recipientUserId,
    transactionAmount: transactions.amount,
    name: transactions.name,
    purchaseDate: transactions.purchaseDate,
    period: transactions.period,
    dueDate: transactions.dueDate,
    paymentMethod: transactions.paymentMethod,
    condition: transactions.condition,
    installmentCount: transactions.installmentCount,
    currentInstallment: transactions.currentInstallment,
    cardName: sourceCardAliases.name,
    accountName: sourceAccountAliases.name,
  };

  const directlyAssigned = await transaction
    .select({
      ...sourceColumns,
      personId: transactions.personId,
      amount: transactions.amount,
      allocationKind: sql<"direct">`'direct'`.as("external_expense_allocation_kind"),
    })
    .from(transactions)
    .innerJoin(
      personConnections,
      and(
        eq(personConnections.ownerUserId, ownerUserId),
        eq(personConnections.personId, transactions.personId),
        eq(personConnections.status, "active"),
      ),
    )
    .leftJoin(
      transactionSplits,
      and(
        eq(transactionSplits.transactionId, transactions.id),
        eq(transactionSplits.userId, ownerUserId),
      ),
    )
    .leftJoin(installmentSeries, eq(transactions.seriesId, installmentSeries.id))
    .leftJoin(sourceCardAliases, eq(transactions.cardId, sourceCardAliases.id))
    .leftJoin(sourceAccountAliases, eq(transactions.accountId, sourceAccountAliases.id))
    .where(
      and(
        eq(transactions.userId, ownerUserId),
        transactionSourceFilter,
        eq(transactions.type, "expense"),
        eq(transactions.origin, "regular"),
        ne(transactions.condition, "recurring"),
        isNotNull(transactions.paymentMethod),
        sql`${transactionSplits.id} IS NULL`,
      ),
    );

  const splitAssignments = await transaction
    .select({
      ...sourceColumns,
      personId: transactionSplits.personId,
      amount: transactionSplits.amount,
      allocationKind: sql<"split">`'split'`.as("external_expense_allocation_kind"),
    })
    .from(transactions)
    .innerJoin(
      transactionSplits,
      and(
        eq(transactionSplits.transactionId, transactions.id),
        eq(transactionSplits.userId, ownerUserId),
      ),
    )
    .innerJoin(
      personConnections,
      and(
        eq(personConnections.ownerUserId, ownerUserId),
        eq(personConnections.personId, transactionSplits.personId),
        eq(personConnections.status, "active"),
      ),
    )
    .leftJoin(installmentSeries, eq(transactions.seriesId, installmentSeries.id))
    .leftJoin(sourceCardAliases, eq(transactions.cardId, sourceCardAliases.id))
    .leftJoin(sourceAccountAliases, eq(transactions.accountId, sourceAccountAliases.id))
    .where(
      and(
        eq(transactions.userId, ownerUserId),
        transactionSourceFilter,
        eq(transactions.type, "expense"),
        eq(transactions.origin, "regular"),
        ne(transactions.condition, "recurring"),
        isNotNull(transactions.paymentMethod),
      ),
    );

  const groupedEligible = groupEligibleSources([
    ...(directlyAssigned as EligibleSourceRow[]),
    ...(splitAssignments as EligibleSourceRow[]),
  ]);
  const logoDomains = await findEstablishmentLogoDomains(
    transaction,
    groupedEligible.map((item) => ({ name: item.snapshot.name, ownerUserId })),
  );
  const eligible: EligibleSource[] = groupedEligible.map((item) => ({
    ...item,
    establishmentLogoDomain:
      logoDomains.get(establishmentLogoKey(ownerUserId, item.snapshot.name)) ?? null,
  }));
  const existing = await transaction
    .select()
    .from(externalExpenses)
    .where(and(eq(externalExpenses.ownerUserId, ownerUserId), externalSourceFilter))
    .for("update");
  const eligibleKeys = new Set(eligible.map((item) => item.key));
  const changedAt = new Date();

  for (const current of existing) {
    if (!canUpdateExternalExpenseSnapshot(current.status)) continue;
    if (
      eligibleKeys.has(
        sourceKey(current.sourceTransactionId, current.sourceSeriesId, current.sourcePersonId),
      )
    ) {
      continue;
    }
    await transaction.delete(externalExpenses).where(eq(externalExpenses.id, current.id));
  }

  for (const item of eligible) {
    const current = existing.find(
      (row) =>
        sourceKey(row.sourceTransactionId, row.sourceSeriesId, row.sourcePersonId) === item.key,
    );
    if (!current) {
      if (allowCreateKeys !== "all" && !allowCreateKeys.has(item.key)) continue;
      await transaction.insert(externalExpenses).values({
        connectionId: item.connectionId,
        ownerUserId,
        recipientUserId: item.recipientUserId,
        sourceKind: item.sourceSeriesId ? "installmentSeries" : "transaction",
        sourceTransactionId: item.sourceTransactionId,
        sourceSeriesId: item.sourceSeriesId,
        sourcePersonId: item.sourcePersonId,
        establishmentLogoDomain: item.establishmentLogoDomain,
        ...snapshotValues(item.snapshot),
      });
      continue;
    }

    if (!canUpdateExternalExpenseSnapshot(current.status)) continue;
    const currentSnapshot = snapshotFromRow(current);
    const nextSnapshot = preserveExternalExpenseInstallmentBoundary(currentSnapshot, item.snapshot);
    if (
      snapshotsEqual(currentSnapshot, nextSnapshot) &&
      current.establishmentLogoDomain === item.establishmentLogoDomain
    ) {
      continue;
    }
    await transaction
      .update(externalExpenses)
      .set({
        connectionId: item.connectionId,
        recipientUserId: item.recipientUserId,
        sourceKind: item.sourceSeriesId ? "installmentSeries" : "transaction",
        sourceTransactionId: item.sourceTransactionId,
        sourceSeriesId: item.sourceSeriesId,
        establishmentLogoDomain: item.establishmentLogoDomain,
        sourceVersion: current.sourceVersion + 1,
        ...snapshotValues(nextSnapshot),
        updatedAt: changedAt,
      })
      .where(eq(externalExpenses.id, current.id));
  }
}

export async function deletePendingExternalExpensesForTransactions(
  transaction: DatabaseTransaction,
  userId: string,
  transactionIds: string[],
) {
  if (!transactionIds.length) return;
  const targets = await transaction
    .select({ id: transactions.id, seriesId: transactions.seriesId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));
  const standaloneIds = targets.flatMap((row) => (row.seriesId ? [] : [row.id]));
  const targetSeries = [...new Set(targets.flatMap((row) => (row.seriesId ? [row.seriesId] : [])))];
  const fullyRemovedSeries: string[] = [];

  for (const seriesId of targetSeries) {
    const [row] = await transaction
      .select({ value: count() })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.seriesId, seriesId)));
    const targetCount = targets.filter((item) => item.seriesId === seriesId).length;
    if (Number(row?.value ?? 0) === targetCount) fullyRemovedSeries.push(seriesId);
  }

  const sourceFilter = externalLogicalSourceFilter(standaloneIds, fullyRemovedSeries);
  if (sourceFilter) {
    await transaction
      .delete(externalExpenses)
      .where(
        and(
          eq(externalExpenses.ownerUserId, userId),
          eq(externalExpenses.status, "pending"),
          sourceFilter,
        ),
      );
  }
}

export async function findExternalExpenseAssignmentKeys(
  transaction: DatabaseTransaction,
  userId: string,
  transactionIds: string[],
) {
  if (!transactionIds.length) return new Set<string>();
  const touched = await transaction
    .select({ id: transactions.id, seriesId: transactions.seriesId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));
  const seriesIds = [...new Set(touched.flatMap((row) => (row.seriesId ? [row.seriesId] : [])))];
  const standaloneIds = touched.flatMap((row) => (row.seriesId ? [] : [row.id]));
  const filter = transactionLogicalSourceFilter(standaloneIds, seriesIds);
  if (!filter) return new Set<string>();

  const direct = await transaction
    .select({
      transactionId: transactions.id,
      seriesId: transactions.seriesId,
      personId: transactions.personId,
    })
    .from(transactions)
    .leftJoin(
      transactionSplits,
      and(
        eq(transactionSplits.transactionId, transactions.id),
        eq(transactionSplits.userId, userId),
      ),
    )
    .where(and(eq(transactions.userId, userId), filter, sql`${transactionSplits.id} IS NULL`));
  const divided = await transaction
    .select({
      transactionId: transactions.id,
      seriesId: transactions.seriesId,
      personId: transactionSplits.personId,
    })
    .from(transactions)
    .innerJoin(
      transactionSplits,
      and(
        eq(transactionSplits.transactionId, transactions.id),
        eq(transactionSplits.userId, userId),
      ),
    )
    .where(and(eq(transactions.userId, userId), filter));

  return new Set(
    [...direct, ...divided].map((row) => sourceKey(row.transactionId, row.seriesId, row.personId)),
  );
}

function externalLogicalSourceFilter(standaloneIds: string[], seriesIds: string[]) {
  const filters = [
    standaloneIds.length ? inArray(externalExpenses.sourceTransactionId, standaloneIds) : undefined,
    seriesIds.length ? inArray(externalExpenses.sourceSeriesId, seriesIds) : undefined,
  ].filter(Boolean);
  return filters.length === 2 ? or(filters[0], filters[1]) : filters[0];
}

function transactionLogicalSourceFilter(standaloneIds: string[], seriesIds: string[]) {
  const filters = [
    standaloneIds.length ? inArray(transactions.id, standaloneIds) : undefined,
    seriesIds.length ? inArray(transactions.seriesId, seriesIds) : undefined,
  ].filter(Boolean);
  return filters.length === 2 ? or(filters[0], filters[1]) : filters[0];
}

async function findEstablishmentLogoDomains(
  executor: Pick<DatabaseTransaction, "select">,
  establishments: Array<{ ownerUserId: string; name: string }>,
) {
  const references = [
    ...new Map(
      establishments.map((item) => [establishmentLogoKey(item.ownerUserId, item.name), item]),
    ).values(),
  ];
  if (!references.length) return new Map<string, string>();

  const rows = await executor
    .select({
      ownerUserId: establishmentLogos.userId,
      nameKey: establishmentLogos.nameKey,
      domain: establishmentLogos.domain,
    })
    .from(establishmentLogos)
    .where(
      and(
        inArray(establishmentLogos.userId, [
          ...new Set(references.map((item) => item.ownerUserId)),
        ]),
        inArray(establishmentLogos.nameKey, [
          ...new Set(references.map((item) => createEstablishmentNameKey(item.name))),
        ]),
      ),
    );

  return new Map(rows.map((row) => [`${row.ownerUserId}:${row.nameKey}`, row.domain] as const));
}

function establishmentLogoKey(ownerUserId: string, name: string) {
  return `${ownerUserId}:${createEstablishmentNameKey(name)}`;
}

function groupEligibleSources(rows: EligibleSourceRow[]) {
  const groups = new Map<string, EligibleSourceRow[]>();
  for (const row of rows) {
    const key = sourceKey(row.transactionId, row.seriesId, row.personId);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...group].sort(
      (left, right) =>
        (left.currentInstallment ?? 1) - (right.currentInstallment ?? 1) ||
        left.purchaseDate.getTime() - right.purchaseDate.getTime(),
    );
    const representative = ordered[0] as EligibleSourceRow;
    const isSeries = Boolean(representative.seriesId);
    const totalInstallments =
      representative.totalInstallments ?? representative.installmentCount ?? ordered.length;
    const trackedFromInstallment =
      representative.trackedFromInstallment ?? representative.currentInstallment ?? 1;
    const sourceTotal = isSeries
      ? representative.allocationKind === "split"
        ? calculateExternalInstallmentAllocationTotal({
            originalTransactionAmount: representative.seriesOriginalAmount ?? 0,
            totalInstallments,
            trackedFromInstallment,
            trackedTransactionAmounts: ordered.map((row) => row.transactionAmount),
            trackedAllocationAmounts: ordered.map((row) => row.amount),
          })
        : calculateExternalInstallmentTotal({
            originalAmount: representative.seriesOriginalAmount ?? 0,
            totalInstallments,
            trackedFromInstallment,
            trackedAmounts: ordered.map((row) => row.transactionAmount),
          })
      : Math.abs(Number(representative.amount));
    const sourceLabel = representative.cardName
      ? `Fatura ${representative.cardName}`
      : representative.accountName;
    const snapshot: ExternalExpenseSnapshot = {
      name: representative.name,
      amount: sourceTotal.toFixed(2),
      purchaseDate: toDate(representative.purchaseDate) as string,
      period: representative.period,
      dueDate: toDate(representative.dueDate),
      paymentMethod: representative.paymentMethod,
      condition: isSeries ? "installment" : "single",
      installmentCount: isSeries
        ? (representative.totalInstallments ?? representative.installmentCount)
        : null,
      currentInstallment: isSeries
        ? (representative.trackedFromInstallment ?? representative.currentInstallment)
        : null,
      sourceLabel,
    };

    return {
      key,
      connectionId: representative.connectionId,
      recipientUserId: representative.recipientUserId,
      sourcePersonId: representative.personId,
      sourceTransactionId: representative.transactionId,
      sourceSeriesId: representative.seriesId,
      snapshot,
    };
  });
}

function sourceKey(transactionId: string | null, seriesId: string | null, personId: string) {
  return `${seriesId ? `series:${seriesId}` : `transaction:${transactionId}`}:${personId}`;
}

function recurringSourceKey(input: {
  ownerUserId: string;
  sourceRecurringSeriesId: string;
  sourceOccurrenceDate: string;
  sourcePersonId: string;
}) {
  return `${input.ownerUserId}:${input.sourceRecurringSeriesId}:${input.sourceOccurrenceDate}:${input.sourcePersonId}`;
}

function snapshotValues(snapshot: ExternalExpenseSnapshot) {
  return {
    name: snapshot.name,
    amount: snapshot.amount,
    purchaseDate: new Date(`${snapshot.purchaseDate}T00:00:00.000Z`),
    period: snapshot.period,
    dueDate: snapshot.dueDate ? new Date(`${snapshot.dueDate}T00:00:00.000Z`) : null,
    sourcePaymentMethod: snapshot.paymentMethod,
    sourceCondition: snapshot.condition,
    installmentCount: snapshot.installmentCount,
    currentInstallment: snapshot.currentInstallment,
    sourceLabel: snapshot.sourceLabel,
  };
}

function snapshotFromRow(row: typeof externalExpenses.$inferSelect): ExternalExpenseSnapshot {
  return {
    name: row.name,
    amount: Number(row.amount).toFixed(2),
    purchaseDate: toDate(row.purchaseDate) as string,
    period: row.period,
    dueDate: toDate(row.dueDate),
    paymentMethod: row.sourcePaymentMethod,
    condition: row.sourceCondition,
    installmentCount: row.installmentCount,
    currentInstallment: row.currentInstallment,
    sourceLabel: row.sourceLabel,
  };
}

function snapshotsEqual(left: ExternalExpenseSnapshot, right: ExternalExpenseSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

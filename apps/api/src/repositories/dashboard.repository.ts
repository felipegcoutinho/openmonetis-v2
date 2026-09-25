import {
  cards,
  categories,
  dashboardPreferences,
  db,
  financialAccounts,
  invoicePaymentAllocations,
  invoicePayments,
  invoices,
  people,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { resolveCardClosingRule } from "@openmonetis/domain/cards";
import { getPeriodEndDate } from "@openmonetis/domain/transactions";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DashboardRepository } from "../services/dashboard.service";

const transactionAccounts = alias(financialAccounts, "dashboard_transaction_accounts");
const cardAccounts = alias(financialAccounts, "dashboard_card_accounts");
const recurringAccounts = alias(financialAccounts, "dashboard_recurring_accounts");
const recurringCardAccounts = alias(financialAccounts, "dashboard_recurring_card_accounts");
const recurringSourceAccounts = alias(financialAccounts, "dashboard_recurring_source_accounts");
const recurringDestinationAccounts = alias(
  financialAccounts,
  "dashboard_recurring_destination_accounts",
);
const transactionPeople = alias(people, "dashboard_transaction_people");
const recurringPeople = alias(people, "dashboard_recurring_people");
const transactionCategories = alias(categories, "dashboard_transaction_categories");
const recurringCategories = alias(categories, "dashboard_recurring_categories");
const transactionSplitPeople = alias(people, "dashboard_transaction_split_people");
const recurringSplitPeople = alias(people, "dashboard_recurring_split_people");

function periodStart(period: string) {
  return new Date(`${period}-01T00:00:00.000Z`);
}

function toDateString(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export const dashboardRepository = {
  async findWidgetPreferences(userId) {
    const [preferences] = await db
      .select({
        order: dashboardPreferences.widgetOrder,
        hidden: dashboardPreferences.hiddenWidgets,
      })
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.userId, userId))
      .limit(1);
    return preferences ?? null;
  },

  async saveWidgetPreferences(userId, preferences) {
    await db
      .insert(dashboardPreferences)
      .values({
        userId,
        widgetOrder: preferences.order,
        hiddenWidgets: preferences.hidden,
      })
      .onConflictDoUpdate({
        target: dashboardPreferences.userId,
        set: {
          widgetOrder: preferences.order,
          hiddenWidgets: preferences.hidden,
          updatedAt: new Date(),
        },
      });
  },

  async deleteWidgetPreferences(userId) {
    await db.delete(dashboardPreferences).where(eq(dashboardPreferences.userId, userId));
  },

  async listTransactionsThroughPeriod(userId, period, startPeriod) {
    const rows = await db
      .select({
        id: transactions.id,
        accountId: sql<string | null>`coalesce(${transactions.accountId}, ${cards.accountId})`.as(
          "account_id",
        ),
        amount: transactions.amount,
        cardId: transactions.cardId,
        categoryId: transactionCategories.id,
        categoryName: transactionCategories.name,
        categoryIcon: transactionCategories.icon,
        adminAmount: sql<string | null>`case
          when exists (
            select 1 from ${transactionSplits}
            where ${transactionSplits.userId} = ${userId}
              and ${transactionSplits.transactionId} = ${transactions.id}
          ) then (
            select ${transactionSplits.amount}
            from ${transactionSplits}
            inner join ${people}
              on ${people.id} = ${transactionSplits.personId}
              and ${people.userId} = ${userId}
              and ${people.role} = 'admin'
            where ${transactionSplits.userId} = ${userId}
              and ${transactionSplits.transactionId} = ${transactions.id}
            limit 1
          )
          when ${transactionPeople.role} = 'admin' then ${transactions.amount}
          else null
        end`.as("admin_amount"),
        condition: transactions.condition,
        isSettled:
          sql<boolean>`case when ${transactions.cardId} is not null then coalesce(${invoices.paymentStatus} = 'paid', false) else coalesce(${transactions.isSettled}, false) end`.as(
            "is_settled",
          ),
        period: transactions.period,
        paymentMethod: transactions.paymentMethod,
        purchaseDate: transactions.purchaseDate,
        dueDate: transactions.dueDate,
        boletoPaymentDate: transactions.boletoPaymentDate,
        personId: transactionPeople.id,
        personName: transactionPeople.name,
        personAvatarUrl: transactionPeople.avatarUrl,
        personRole: transactionPeople.role,
        personStatus: transactionPeople.status,
        type: transactions.type,
        origin: transactions.origin,
        excludeFromBalance:
          sql<boolean>`coalesce(${transactionAccounts.excludeFromBalance}, ${cardAccounts.excludeFromBalance}, false)`.as(
            "exclude_from_balance",
          ),
      })
      .from(transactions)
      .innerJoin(
        transactionPeople,
        and(eq(transactions.personId, transactionPeople.id), eq(transactionPeople.userId, userId)),
      )
      .leftJoin(
        transactionCategories,
        and(
          eq(transactions.categoryId, transactionCategories.id),
          eq(transactionCategories.userId, userId),
        ),
      )
      .leftJoin(
        transactionAccounts,
        and(
          eq(transactions.accountId, transactionAccounts.id),
          eq(transactionAccounts.userId, userId),
        ),
      )
      .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
      .leftJoin(
        invoices,
        and(
          eq(invoices.userId, userId),
          eq(invoices.cardId, transactions.cardId),
          eq(invoices.period, transactions.period),
        ),
      )
      .leftJoin(
        cardAccounts,
        and(eq(cards.accountId, cardAccounts.id), eq(cardAccounts.userId, userId)),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          startPeriod
            ? or(
                gte(transactions.period, startPeriod),
                gte(transactions.purchaseDate, periodStart(startPeriod)),
              )
            : undefined,
          or(
            lte(transactions.period, period),
            lte(transactions.purchaseDate, getPeriodEndDate(period)),
          ),
        ),
      );

    return rows.map((row) => ({
      ...row,
      purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
      dueDate: toDateString(row.dueDate),
      boletoPaymentDate: toDateString(row.boletoPaymentDate),
    }));
  },

  async listRecurringRules(userId, periodEnd) {
    const rows = await db
      .select({
        id: recurringTransactionRules.id,
        seriesId: recurringTransactionRules.seriesId,
        accountId: sql<
          string | null
        >`coalesce(${recurringTransactionRules.accountId}, ${cards.accountId})`.as("account_id"),
        amount: recurringTransactionRules.amount,
        categoryId: recurringCategories.id,
        categoryName: recurringCategories.name,
        categoryIcon: recurringCategories.icon,
        adminAmount: sql<string | null>`case
          when exists (
            select 1 from ${recurringTransactionSplits}
            where ${recurringTransactionSplits.userId} = ${userId}
              and ${recurringTransactionSplits.recurringRuleId} = ${recurringTransactionRules.id}
          ) then (
            select ${recurringTransactionSplits.amount}
            from ${recurringTransactionSplits}
            inner join ${people}
              on ${people.id} = ${recurringTransactionSplits.personId}
              and ${people.userId} = ${userId}
              and ${people.role} = 'admin'
            where ${recurringTransactionSplits.userId} = ${userId}
              and ${recurringTransactionSplits.recurringRuleId} = ${recurringTransactionRules.id}
            limit 1
          )
          when ${recurringPeople.role} = 'admin' then ${recurringTransactionRules.amount}
          else null
        end`.as("admin_amount"),
        cardId: recurringTransactionRules.cardId,
        isSettled: recurringTransactionRules.isSettled,
        type: recurringTransactionRules.type,
        sourceAccountId: recurringTransactionRules.sourceAccountId,
        destinationAccountId: recurringTransactionRules.destinationAccountId,
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        anchorDate: recurringTransactionRules.anchorDate,
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        dueDate: recurringTransactionRules.dueDate,
        personId: recurringPeople.id,
        personName: recurringPeople.name,
        personAvatarUrl: recurringPeople.avatarUrl,
        personRole: recurringPeople.role,
        personStatus: recurringPeople.status,
        cardClosingDay: cards.closingDay,
        cardClosingRuleType: cards.closingRuleType,
        cardClosingOffsetDays: cards.closingOffsetDays,
        cardClosingOffsetMode: cards.closingOffsetMode,
        cardDueDay: cards.dueDay,
        excludeFromBalance:
          sql<boolean>`coalesce(${recurringAccounts.excludeFromBalance}, ${recurringCardAccounts.excludeFromBalance}, false)`.as(
            "exclude_from_balance",
          ),
        sourceExcludeFromBalance:
          sql<boolean>`coalesce(${recurringSourceAccounts.excludeFromBalance}, false)`.as(
            "source_exclude_from_balance",
          ),
        destinationExcludeFromBalance:
          sql<boolean>`coalesce(${recurringDestinationAccounts.excludeFromBalance}, false)`.as(
            "destination_exclude_from_balance",
          ),
      })
      .from(recurringTransactionRules)
      .innerJoin(
        recurringPeople,
        and(
          eq(recurringTransactionRules.personId, recurringPeople.id),
          eq(recurringPeople.userId, userId),
        ),
      )
      .leftJoin(
        recurringCategories,
        and(
          eq(recurringTransactionRules.categoryId, recurringCategories.id),
          eq(recurringCategories.userId, userId),
        ),
      )
      .leftJoin(
        recurringAccounts,
        and(
          eq(recurringTransactionRules.accountId, recurringAccounts.id),
          eq(recurringAccounts.userId, userId),
        ),
      )
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .leftJoin(
        recurringCardAccounts,
        and(
          eq(cards.accountId, recurringCardAccounts.id),
          eq(recurringCardAccounts.userId, userId),
        ),
      )
      .leftJoin(
        recurringSourceAccounts,
        and(
          eq(recurringTransactionRules.sourceAccountId, recurringSourceAccounts.id),
          eq(recurringSourceAccounts.userId, userId),
        ),
      )
      .leftJoin(
        recurringDestinationAccounts,
        and(
          eq(recurringTransactionRules.destinationAccountId, recurringDestinationAccounts.id),
          eq(recurringDestinationAccounts.userId, userId),
        ),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          eq(recurringTransactionRules.status, "active"),
          lte(recurringTransactionRules.startDate, periodEnd),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      seriesId: row.seriesId,
      accountId: row.accountId,
      amount: row.amount,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      adminAmount: row.adminAmount,
      cardId: row.cardId,
      isSettled: row.isSettled,
      type: row.type,
      sourceAccountId: row.sourceAccountId,
      destinationAccountId: row.destinationAccountId,
      frequency: row.frequency,
      paymentMethod: row.paymentMethod,
      anchorDate: row.anchorDate.toISOString().slice(0, 10),
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      personRole: row.personRole,
      personStatus: row.personStatus,
      origin: "regular" as const,
      excludeFromBalance: row.excludeFromBalance,
      sourceExcludeFromBalance: row.sourceExcludeFromBalance,
      destinationExcludeFromBalance: row.destinationExcludeFromBalance,
      card:
        row.cardClosingRuleType !== null && row.cardDueDay !== null
          ? {
              closingDay: row.cardClosingDay,
              closingRule: resolveCardClosingRule({
                closingRuleType: row.cardClosingRuleType,
                closingDay: row.cardClosingDay,
                closingOffsetDays: row.cardClosingOffsetDays,
                closingOffsetMode: row.cardClosingOffsetMode,
              }),
              dueDay: row.cardDueDay,
            }
          : null,
    }));
  },

  listTransactionPersonSplits(userId, period) {
    return db
      .select({
        amount: transactionSplits.amount,
        personAvatarUrl: transactionSplitPeople.avatarUrl,
        personId: transactionSplitPeople.id,
        personName: transactionSplitPeople.name,
        personRole: transactionSplitPeople.role,
        personStatus: transactionSplitPeople.status,
        transactionId: transactionSplits.transactionId,
      })
      .from(transactionSplits)
      .innerJoin(
        transactions,
        and(eq(transactionSplits.transactionId, transactions.id), eq(transactions.userId, userId)),
      )
      .innerJoin(
        transactionSplitPeople,
        and(
          eq(transactionSplits.personId, transactionSplitPeople.id),
          eq(transactionSplitPeople.userId, userId),
        ),
      )
      .where(
        and(
          eq(transactionSplits.userId, userId),
          or(
            lte(transactions.period, period),
            lte(transactions.purchaseDate, getPeriodEndDate(period)),
          ),
        ),
      );
  },

  listRecurringPersonSplits(userId, periodEnd) {
    return db
      .select({
        amount: recurringTransactionSplits.amount,
        personAvatarUrl: recurringSplitPeople.avatarUrl,
        personId: recurringSplitPeople.id,
        personName: recurringSplitPeople.name,
        personRole: recurringSplitPeople.role,
        personStatus: recurringSplitPeople.status,
        recurringRuleId: recurringTransactionSplits.recurringRuleId,
      })
      .from(recurringTransactionSplits)
      .innerJoin(
        recurringTransactionRules,
        and(
          eq(recurringTransactionSplits.recurringRuleId, recurringTransactionRules.id),
          eq(recurringTransactionRules.userId, userId),
          lte(recurringTransactionRules.startDate, periodEnd),
        ),
      )
      .innerJoin(
        recurringSplitPeople,
        and(
          eq(recurringTransactionSplits.personId, recurringSplitPeople.id),
          eq(recurringSplitPeople.userId, userId),
        ),
      )
      .where(eq(recurringTransactionSplits.userId, userId));
  },

  async listRecurringOccurrenceStates(userId, periodEnd) {
    const rows = await db
      .select({
        recurringSeriesId: recurringTransactionOccurrences.recurringSeriesId,
        purchaseDate: recurringTransactionOccurrences.purchaseDate,
        boletoPaymentDate: recurringTransactionOccurrences.boletoPaymentDate,
        isSettled: recurringTransactionOccurrences.isSettled,
      })
      .from(recurringTransactionOccurrences)
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, userId),
          lte(recurringTransactionOccurrences.purchaseDate, periodEnd),
        ),
      );

    return rows.map((row) => ({
      ...row,
      purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
      boletoPaymentDate: toDateString(row.boletoPaymentDate),
    }));
  },

  async listInvoiceStatuses(userId, period) {
    const rows = await db
      .select({
        cardId: invoices.cardId,
        paymentStatus: invoices.paymentStatus,
        period: invoices.period,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), lte(invoices.period, period)));

    return rows.map((row) => ({
      cardId: row.cardId,
      isPaid: row.paymentStatus === "paid",
      period: row.period,
    }));
  },

  listAdminInvoicePaymentAllocations(userId, period) {
    return db
      .select({
        amount: invoicePaymentAllocations.amount,
        cardId: invoicePayments.cardId,
        period: invoicePayments.period,
      })
      .from(invoicePaymentAllocations)
      .innerJoin(
        invoicePayments,
        and(
          eq(invoicePaymentAllocations.paymentId, invoicePayments.id),
          eq(invoicePayments.userId, userId),
        ),
      )
      .innerJoin(
        people,
        and(
          eq(invoicePaymentAllocations.personId, people.id),
          eq(people.userId, userId),
          eq(people.role, "admin"),
        ),
      )
      .where(
        and(eq(invoicePaymentAllocations.userId, userId), lte(invoicePayments.period, period)),
      );
  },
} satisfies DashboardRepository;

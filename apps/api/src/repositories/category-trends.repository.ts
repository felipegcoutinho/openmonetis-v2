import {
  cards,
  categories,
  db,
  people,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { resolveCardClosingRule } from "@openmonetis/domain/cards";
import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CategoryTrendsRepository } from "../services/category-trends.service";

const transactionPeople = alias(people, "category_trend_transaction_people");
const splitPeople = alias(people, "category_trend_split_people");
const recurringPeople = alias(people, "category_trend_recurring_people");
const recurringSplitPeople = alias(people, "category_trend_recurring_split_people");

export const categoryTrendsRepository = {
  async listCategoriesForUser(userId) {
    const rows = await db
      .select({
        categoryId: categories.id,
        name: categories.name,
        icon: categories.icon,
        type: categories.type,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), ne(categories.name, invoicePaymentCategoryName)))
      .orderBy(asc(categories.name), asc(categories.id));
    return rows;
  },

  async listActualEntriesForUser(
    userId,
    startPeriod,
    endPeriod,
    categoryIds,
    personScope = "admin",
  ) {
    const rows = await db
      .select({
        categoryId: categories.id,
        origin: transactions.origin,
        transactionType: transactions.type,
        type: categories.type,
        period: transactions.period,
        amount:
          sql<string>`case when ${transactionSplits.id} is not null then ${transactionSplits.amount} else ${transactions.amount} end`.as(
            "amount",
          ),
      })
      .from(transactions)
      .innerJoin(
        transactionPeople,
        and(eq(transactions.personId, transactionPeople.id), eq(transactionPeople.userId, userId)),
      )
      .leftJoin(
        transactionSplits,
        and(
          eq(transactionSplits.transactionId, transactions.id),
          eq(transactionSplits.userId, userId),
        ),
      )
      .leftJoin(
        splitPeople,
        and(eq(transactionSplits.personId, splitPeople.id), eq(splitPeople.userId, userId)),
      )
      .innerJoin(
        categories,
        and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          ne(transactions.type, "transfer"),
          ne(categories.name, invoicePaymentCategoryName),
          gte(transactions.period, startPeriod),
          lte(transactions.period, endPeriod),
          personScope === "all"
            ? undefined
            : or(
                and(
                  isNull(transactionSplits.id),
                  personScope === "admin"
                    ? eq(transactionPeople.role, "admin")
                    : eq(transactionPeople.id, personScope),
                ),
                personScope === "admin"
                  ? eq(splitPeople.role, "admin")
                  : eq(splitPeople.id, personScope),
              ),
          categoryIds.length ? inArray(categories.id, [...categoryIds]) : undefined,
        ),
      )
      .orderBy(asc(transactions.period), asc(categories.name), asc(categories.id));
    return rows;
  },

  async listRecurringRulesForUser(userId, periodEnd, categoryIds, personScope = "admin") {
    const rows = await db
      .select({
        categoryId: categories.id,
        type: categories.type,
        amount:
          sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.amount} else ${recurringTransactionRules.amount} end`.as(
            "amount",
          ),
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        dueDate: recurringTransactionRules.dueDate,
        status: recurringTransactionRules.status,
        cardClosingDay: cards.closingDay,
        cardClosingRuleType: cards.closingRuleType,
        cardClosingOffsetDays: cards.closingOffsetDays,
        cardClosingOffsetMode: cards.closingOffsetMode,
        cardDueDay: cards.dueDay,
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
        recurringTransactionSplits,
        and(
          eq(recurringTransactionSplits.recurringRuleId, recurringTransactionRules.id),
          eq(recurringTransactionSplits.userId, userId),
        ),
      )
      .leftJoin(
        recurringSplitPeople,
        and(
          eq(recurringTransactionSplits.personId, recurringSplitPeople.id),
          eq(recurringSplitPeople.userId, userId),
        ),
      )
      .innerJoin(
        categories,
        and(eq(recurringTransactionRules.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          ne(recurringTransactionRules.type, "transfer"),
          ne(categories.name, invoicePaymentCategoryName),
          lte(recurringTransactionRules.startDate, periodEnd),
          personScope === "all"
            ? undefined
            : or(
                and(
                  isNull(recurringTransactionSplits.id),
                  personScope === "admin"
                    ? eq(recurringPeople.role, "admin")
                    : eq(recurringPeople.id, personScope),
                ),
                personScope === "admin"
                  ? eq(recurringSplitPeople.role, "admin")
                  : eq(recurringSplitPeople.id, personScope),
              ),
          categoryIds.length ? inArray(categories.id, [...categoryIds]) : undefined,
        ),
      )
      .orderBy(asc(recurringTransactionRules.startDate), asc(recurringTransactionRules.id));

    return rows.map((row) => ({
      categoryId: row.categoryId,
      type: row.type,
      amount: row.amount,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      frequency: row.frequency,
      paymentMethod: row.paymentMethod,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      status: row.status,
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
} satisfies CategoryTrendsRepository;

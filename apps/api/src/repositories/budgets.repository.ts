import {
  budgets,
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
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BudgetsRepository } from "../services/budgets.service";

const transactionPeople = alias(people, "budget_transaction_people");
const splitPeople = alias(people, "budget_split_people");
const recurringPeople = alias(people, "budget_recurring_people");
const recurringSplitPeople = alias(people, "budget_recurring_split_people");

const budgetWithCategoryColumns = {
  id: budgets.id,
  userId: budgets.userId,
  categoryId: budgets.categoryId,
  period: budgets.period,
  amount: budgets.amount,
  createdAt: budgets.createdAt,
  updatedAt: budgets.updatedAt,
  categoryName: categories.name,
  categoryIcon: categories.icon,
};

export const budgetsRepository = {
  async insertIfAbsent(data) {
    const [budget] = await db
      .insert(budgets)
      .values(data)
      .onConflictDoNothing({ target: [budgets.userId, budgets.categoryId, budgets.period] })
      .returning();
    return budget ?? null;
  },

  listByUserAndPeriod(userId, period) {
    return db
      .select(budgetWithCategoryColumns)
      .from(budgets)
      .innerJoin(
        categories,
        and(eq(budgets.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(and(eq(budgets.userId, userId), eq(budgets.period, period)))
      .orderBy(asc(categories.name));
  },

  async findByIdForUser(id, userId) {
    const [budget] = await db
      .select(budgetWithCategoryColumns)
      .from(budgets)
      .innerJoin(
        categories,
        and(eq(budgets.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .limit(1);
    return budget ?? null;
  },

  async findByCategoryAndPeriodForUser(categoryId, period, userId) {
    const [budget] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.categoryId, categoryId),
          eq(budgets.period, period),
          eq(budgets.userId, userId),
        ),
      )
      .limit(1);
    return budget ?? null;
  },

  async updateForUser(id, userId, data) {
    const [budget] = await db
      .update(budgets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return budget ?? null;
  },

  async deleteForUser(id, userId) {
    const [budget] = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return budget ?? null;
  },

  listSpendingEntries(userId, period) {
    return db
      .select({
        categoryId: transactions.categoryId,
        origin: transactions.origin,
        type: transactions.type,
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
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.period, period),
          or(
            and(isNull(transactionSplits.id), eq(transactionPeople.role, "admin")),
            eq(splitPeople.role, "admin"),
          ),
        ),
      );
  },

  async listRecurringRules(userId, periodEnd) {
    const rows = await db
      .select({
        categoryId: recurringTransactionRules.categoryId,
        type: recurringTransactionRules.type,
        amount:
          sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.amount} else ${recurringTransactionRules.amount} end`.as(
            "amount",
          ),
        anchorDate: recurringTransactionRules.anchorDate,
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
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          lte(recurringTransactionRules.startDate, periodEnd),
          or(
            and(isNull(recurringTransactionSplits.id), eq(recurringPeople.role, "admin")),
            eq(recurringSplitPeople.role, "admin"),
          ),
        ),
      );

    return rows.map((row) => ({
      categoryId: row.categoryId,
      type: row.type,
      amount: row.amount,
      anchorDate: row.anchorDate.toISOString().slice(0, 10),
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

  insertCopies(data) {
    return db
      .insert(budgets)
      .values(data)
      .onConflictDoNothing({ target: [budgets.userId, budgets.categoryId, budgets.period] })
      .returning();
  },
} satisfies BudgetsRepository;

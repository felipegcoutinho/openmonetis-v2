import {
  budgetRules,
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
import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BudgetRuleStore, BudgetsRepository } from "../services/budgets.service";
import { categoryLabelSql } from "./categories.repository";
import { effectiveRecurringEndDateSql } from "./recurring-transactions.repository";
import {
  effectiveSplitAmountSql,
  effectiveTransactionAmountSql,
  recurringOccurrenceOverridesSql,
} from "./settlements.repository";

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
  categoryName: categoryLabelSql(categories),
  categoryIcon: categories.icon,
};

const budgetRuleWithCategoryColumns = {
  id: budgetRules.id,
  userId: budgetRules.userId,
  categoryId: budgetRules.categoryId,
  amount: budgetRules.amount,
  startPeriod: budgetRules.startPeriod,
  endPeriod: budgetRules.endPeriod,
  createdAt: budgetRules.createdAt,
  updatedAt: budgetRules.updatedAt,
  categoryName: categoryLabelSql(categories),
  categoryIcon: categories.icon,
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function createBudgetRuleStore(
  transaction: Transaction,
  userId: string,
  categoryId: string,
): BudgetRuleStore {
  return {
    listRules() {
      return transaction
        .select()
        .from(budgetRules)
        .where(and(eq(budgetRules.userId, userId), eq(budgetRules.categoryId, categoryId)))
        .orderBy(asc(budgetRules.startPeriod));
    },

    async findMonthlyBudget(period) {
      const [budget] = await transaction
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.categoryId, categoryId),
            eq(budgets.period, period),
          ),
        )
        .limit(1);
      return budget ?? null;
    },

    async apply(change) {
      if (change.deleteMonthlyBudgetId) {
        await transaction
          .delete(budgets)
          .where(and(eq(budgets.id, change.deleteMonthlyBudgetId), eq(budgets.userId, userId)));
      }
      if (change.removeAdjustments) {
        const { fromPeriod, toPeriod } = change.removeAdjustments;
        await transaction
          .delete(budgets)
          .where(
            and(
              eq(budgets.userId, userId),
              eq(budgets.categoryId, categoryId),
              gte(budgets.period, fromPeriod),
              toPeriod === null ? undefined : lte(budgets.period, toPeriod),
            ),
          );
      }
      if (change.deleteRuleId) {
        await transaction
          .delete(budgetRules)
          .where(and(eq(budgetRules.id, change.deleteRuleId), eq(budgetRules.userId, userId)));
      }
      if (change.updateRule) {
        const { id, ...values } = change.updateRule;
        await transaction
          .update(budgetRules)
          .set({ ...values, updatedAt: new Date() })
          .where(and(eq(budgetRules.id, id), eq(budgetRules.userId, userId)));
      }
      if (change.insertRule) {
        await transaction.insert(budgetRules).values({ ...change.insertRule, userId, categoryId });
      }
      if (change.upsertMonthlyBudget) {
        await transaction
          .insert(budgets)
          .values({ ...change.upsertMonthlyBudget, userId, categoryId })
          .onConflictDoUpdate({
            target: [budgets.userId, budgets.categoryId, budgets.period],
            set: { amount: change.upsertMonthlyBudget.amount, updatedAt: new Date() },
          });
      }
    },
  };
}

export const budgetsRepository = {
  listRulesForPeriod(userId, period) {
    return db
      .select(budgetRuleWithCategoryColumns)
      .from(budgetRules)
      .innerJoin(
        categories,
        and(eq(budgetRules.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(
        and(
          eq(budgetRules.userId, userId),
          lte(budgetRules.startPeriod, period),
          or(isNull(budgetRules.endPeriod), gte(budgetRules.endPeriod, period)),
        ),
      );
  },

  async findRuleForUser(id, userId) {
    const [rule] = await db
      .select()
      .from(budgetRules)
      .where(and(eq(budgetRules.id, id), eq(budgetRules.userId, userId)))
      .limit(1);
    return rule ?? null;
  },

  withCategoryLock(userId, categoryId, work) {
    return db.transaction(async (transaction) => {
      await transaction
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
        .for("update");
      return work(createBudgetRuleStore(transaction, userId, categoryId));
    });
  },

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
          sql<string>`case when ${transactionSplits.id} is not null then ${effectiveSplitAmountSql} else ${effectiveTransactionAmountSql} end`.as(
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
        endDate: effectiveRecurringEndDateSql,

        configuredEndDate: sql<
          string | null
        >`to_char(${recurringTransactionRules.recurrenceEndDate}, 'YYYY-MM-DD')`.as(
          "configured_end_date",
        ),
        occurrenceOverrides: recurringOccurrenceOverridesSql,
        allocationPersonId:
          sql<string>`coalesce(${recurringTransactionSplits.personId}, ${recurringTransactionRules.personId})`.as(
            "allocation_person_id",
          ),
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        dueDate: recurringTransactionRules.dueDate,
        status: recurringTransactionRules.status,
        cardClosingDay: cards.closingDay,
        cardClosingRuleType: cards.closingRuleType,
        cardClosingOffsetDays: cards.closingOffsetDays,
        cardClosingOffsetMode: cards.closingOffsetMode,
        cardClosingDayPurchasesNextInvoice: cards.closingDayPurchasesNextInvoice,
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
          lte(recurringTransactionRules.startDate, new Date(periodEnd.getTime() + 32 * 86_400_000)),
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
      occurrenceOverrides: row.occurrenceOverrides,
      allocationPersonId: row.allocationPersonId,

      configuredEndDate: row.configuredEndDate,
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
                closingDayPurchasesNextInvoice: row.cardClosingDayPurchasesNextInvoice ?? false,
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

import {
  cards,
  categories,
  db,
  financialAccounts,
  installmentSeries,
  invoicePayments,
  invoices,
  people,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { balanceAdjustmentCategoryName, yieldCategoryName } from "@openmonetis/domain/categories";
import { and, asc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AccountsRepository } from "../services/accounts.service";

const transactionPeople = alias(people, "account_balance_transaction_people");
const splitPeople = alias(people, "account_balance_split_people");
const recurringPeople = alias(people, "account_balance_recurring_people");
const recurringSplitPeople = alias(people, "account_balance_recurring_split_people");

export const accountsRepository = {
  async insert(data) {
    const [account] = await db.insert(financialAccounts).values(data).returning();
    return account;
  },

  async insertBalanceAdjustment(data) {
    await db.transaction(async (tx) => {
      const [admin] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.userId, data.userId), eq(people.role, "admin")))
        .limit(1);
      if (!admin) {
        throw new Error("Account balance adjustment dependencies not found");
      }
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, data.userId),
            eq(categories.name, balanceAdjustmentCategoryName),
            eq(categories.type, data.type),
          ),
        )
        .limit(1);
      if (!category) {
        throw new Error("Account balance adjustment dependencies not found");
      }
      await tx.insert(transactions).values({
        userId: data.userId,
        personId: admin.id,
        type: data.type,
        origin: "accountBalanceAdjustment",
        condition: "single",
        paymentMethod: null,
        name: `Ajuste de saldo - ${data.accountName}`,
        amount: data.amount,
        purchaseDate: new Date(`${data.date}T00:00:00.000Z`),
        period: data.date.slice(0, 7),
        accountId: data.accountId,
        categoryId: category.id,
        isSettled: true,
        note: data.note,
      });
    });
  },

  async insertYield(data) {
    await db.transaction(async (tx) => {
      const [admin] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.userId, data.userId), eq(people.role, "admin")))
        .limit(1);
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, data.userId),
            eq(categories.name, yieldCategoryName),
            eq(categories.type, "income"),
          ),
        )
        .limit(1);
      if (!admin || !category) {
        throw new Error("Account yield dependencies not found");
      }
      await tx.insert(transactions).values({
        userId: data.userId,
        personId: admin.id,
        type: "income",
        origin: "regular",
        condition: "single",
        paymentMethod: "bank_transfer",
        name: `Rendimento - ${data.accountName}`,
        amount: data.amount,
        purchaseDate: new Date(`${data.date}T00:00:00.000Z`),
        period: data.date.slice(0, 7),
        accountId: data.accountId,
        categoryId: category.id,
        isSettled: true,
        note: data.note,
      });
    });
  },

  async deleteInactiveForUser(id, userId) {
    return db.transaction(async (transaction) => {
      const [account] = await transaction
        .select({ id: financialAccounts.id, isArchived: financialAccounts.isArchived })
        .from(financialAccounts)
        .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
        .for("update")
        .limit(1);

      if (!account) return { status: "not_found" as const };
      if (!account.isArchived) return { status: "active" as const };

      const accountCards = await transaction
        .select({ id: cards.id })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.accountId, id)));
      const cardIds = accountCards.map((card) => card.id);
      const cardIdSet = new Set(cardIds);

      const payments = await transaction
        .select({
          id: invoicePayments.id,
          cardId: invoicePayments.cardId,
          period: invoicePayments.period,
          transactionId: invoicePayments.transactionId,
        })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, userId),
            or(
              eq(invoicePayments.accountId, id),
              cardIds.length ? inArray(invoicePayments.cardId, cardIds) : undefined,
            ),
          ),
        );

      if (payments.length) {
        await transaction.delete(invoicePayments).where(
          and(
            eq(invoicePayments.userId, userId),
            inArray(
              invoicePayments.id,
              payments.map((payment) => payment.id),
            ),
          ),
        );
      }

      const retainedCardPayments = payments.filter((payment) => !cardIdSet.has(payment.cardId));
      if (retainedCardPayments.length) {
        await transaction
          .update(invoices)
          .set({
            paymentStatus: "pending",
            paidAt: null,
            paymentAccountId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoices.userId, userId),
              or(
                ...retainedCardPayments.map((payment) =>
                  and(eq(invoices.cardId, payment.cardId), eq(invoices.period, payment.period)),
                ),
              ),
            ),
          );
      }

      const paymentTransactionIds = payments.flatMap((payment) =>
        payment.transactionId ? [payment.transactionId] : [],
      );
      const relatedTransactions = await transaction
        .select({ id: transactions.id, seriesId: transactions.seriesId })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            or(
              eq(transactions.accountId, id),
              eq(transactions.sourceAccountId, id),
              eq(transactions.destinationAccountId, id),
              cardIds.length ? inArray(transactions.cardId, cardIds) : undefined,
              paymentTransactionIds.length
                ? inArray(transactions.id, paymentTransactionIds)
                : undefined,
            ),
          ),
        );

      if (relatedTransactions.length) {
        await transaction.delete(transactions).where(
          and(
            eq(transactions.userId, userId),
            inArray(
              transactions.id,
              relatedTransactions.map((row) => row.id),
            ),
          ),
        );
      }

      await transaction
        .delete(recurringTransactionOccurrences)
        .where(
          and(
            eq(recurringTransactionOccurrences.userId, userId),
            eq(recurringTransactionOccurrences.accountId, id),
          ),
        );

      await transaction
        .delete(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.userId, userId),
            or(
              eq(recurringTransactionRules.accountId, id),
              eq(recurringTransactionRules.sourceAccountId, id),
              eq(recurringTransactionRules.destinationAccountId, id),
              cardIds.length ? inArray(recurringTransactionRules.cardId, cardIds) : undefined,
            ),
          ),
        );

      if (cardIds.length) {
        await transaction
          .delete(cards)
          .where(and(eq(cards.userId, userId), inArray(cards.id, cardIds)));
      }

      const candidateSeriesIds = [
        ...new Set(
          relatedTransactions.flatMap((row) => (row.seriesId === null ? [] : [row.seriesId])),
        ),
      ];
      if (candidateSeriesIds.length) {
        const retainedSeries = await transaction
          .select({ id: transactions.seriesId })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              inArray(transactions.seriesId, candidateSeriesIds),
            ),
          );
        const retainedSeriesIds = new Set(retainedSeries.map((row) => row.id));
        const orphanSeriesIds = candidateSeriesIds.filter(
          (seriesId) => !retainedSeriesIds.has(seriesId),
        );

        if (orphanSeriesIds.length) {
          await transaction
            .delete(installmentSeries)
            .where(
              and(
                eq(installmentSeries.userId, userId),
                inArray(installmentSeries.id, orphanSeriesIds),
              ),
            );
        }
      }

      await transaction
        .delete(financialAccounts)
        .where(
          and(
            eq(financialAccounts.id, id),
            eq(financialAccounts.userId, userId),
            eq(financialAccounts.isArchived, true),
          ),
        )
        .returning({ id: financialAccounts.id });

      return { status: "deleted" as const, id: account.id };
    });
  },

  listByUser(userId) {
    return db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.userId, userId))
      .orderBy(asc(financialAccounts.createdAt));
  },

  async findByIdForUser(id, userId) {
    const [account] = await db
      .select()
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
      .limit(1);

    return account ?? null;
  },

  async updateForUser(id, userId, data) {
    const [account] = await db
      .update(financialAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
      .returning();

    return account ?? null;
  },

  async listSettledAccountPostingsThroughPeriod(userId, period, accountId) {
    const postings = await db
      .select({
        accountId: transactions.accountId,
        period: transactions.period,
        purchaseDate: transactions.purchaseDate,
        paymentMethod: transactions.paymentMethod,
        boletoPaymentDate: transactions.boletoPaymentDate,
        amount:
          sql<string>`sum(case when ${transactionSplits.id} is not null then ${transactionSplits.amount} else ${transactions.amount} end)`.as(
            "amount",
          ),
        includeInSummary: sql<boolean>`${transactions.origin} <> 'accountBalanceAdjustment'`.as(
          "include_in_summary",
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
          eq(transactions.isSettled, true),
          ne(transactions.origin, "personSettlement"),
          or(
            and(
              or(isNull(transactions.paymentMethod), ne(transactions.paymentMethod, "boleto")),
              lte(transactions.period, period),
            ),
            and(eq(transactions.paymentMethod, "boleto"), eq(transactions.type, "expense")),
          ),
          or(
            and(isNull(transactionSplits.id), eq(transactionPeople.role, "admin")),
            eq(splitPeople.role, "admin"),
          ),
          ...(accountId ? [eq(transactions.accountId, accountId)] : []),
        ),
      )
      .groupBy(
        transactions.accountId,
        transactions.period,
        transactions.purchaseDate,
        transactions.origin,
        transactions.paymentMethod,
        transactions.boletoPaymentDate,
      );

    return postings.map((posting) => ({
      ...posting,
      postingDate:
        posting.boletoPaymentDate?.toISOString().slice(0, 10) ??
        posting.purchaseDate.toISOString().slice(0, 10),
      boletoPaymentDate: posting.boletoPaymentDate?.toISOString().slice(0, 10) ?? null,
    }));
  },

  async listAccountRecurringRulesThroughPeriod(userId, periodEnd, _accountId) {
    const [adminRows, billRows] = await Promise.all([
      db
        .select({
          id: recurringTransactionRules.id,
          accountId: recurringTransactionRules.accountId,
          sourceAccountId: recurringTransactionRules.sourceAccountId,
          destinationAccountId: recurringTransactionRules.destinationAccountId,
          amount:
            sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.amount} else ${recurringTransactionRules.amount} end`.as(
              "amount",
            ),
          type: recurringTransactionRules.type,
          paymentMethod: recurringTransactionRules.paymentMethod,
          startDate: recurringTransactionRules.startDate,
          endDate: recurringTransactionRules.endDate,
          dueDate: recurringTransactionRules.dueDate,
          frequency: recurringTransactionRules.frequency,
          isSettled: recurringTransactionRules.isSettled,
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
        .where(
          and(
            eq(recurringTransactionRules.userId, userId),
            eq(recurringTransactionRules.status, "active"),
            ne(recurringTransactionRules.paymentMethod, "boleto"),
            lte(recurringTransactionRules.startDate, periodEnd),
            or(
              and(isNull(recurringTransactionSplits.id), eq(recurringPeople.role, "admin")),
              eq(recurringSplitPeople.role, "admin"),
            ),
          ),
        ),
      db
        .select({
          id: recurringTransactionRules.id,
          accountId: recurringTransactionRules.accountId,
          sourceAccountId: recurringTransactionRules.sourceAccountId,
          destinationAccountId: recurringTransactionRules.destinationAccountId,
          amount:
            sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.amount} else ${recurringTransactionRules.amount} end`.as(
              "amount",
            ),
          type: recurringTransactionRules.type,
          paymentMethod: recurringTransactionRules.paymentMethod,
          startDate: recurringTransactionRules.startDate,
          endDate: recurringTransactionRules.endDate,
          dueDate: recurringTransactionRules.dueDate,
          frequency: recurringTransactionRules.frequency,
          isSettled: recurringTransactionRules.isSettled,
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
        // A boleto occurrence can affect the account before its scheduled month when paid early.
        .where(
          and(
            eq(recurringTransactionRules.userId, userId),
            eq(recurringTransactionRules.status, "active"),
            eq(recurringTransactionRules.type, "expense"),
            eq(recurringTransactionRules.paymentMethod, "boleto"),
            or(
              and(isNull(recurringTransactionSplits.id), eq(recurringPeople.role, "admin")),
              eq(recurringSplitPeople.role, "admin"),
            ),
          ),
        ),
    ]);

    return [...adminRows, ...billRows].map((row) => ({
      ...row,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    }));
  },

  async listRecurringOccurrenceStatesThroughPeriod(userId, recurringRuleIds, periodEnd) {
    if (!recurringRuleIds.length) return [];

    const rows = await db
      .select({
        recurringRuleId: recurringTransactionOccurrences.recurringRuleId,
        purchaseDate: recurringTransactionOccurrences.purchaseDate,
        isSettled: recurringTransactionOccurrences.isSettled,
        accountId: recurringTransactionOccurrences.accountId,
        boletoPaymentDate: recurringTransactionOccurrences.boletoPaymentDate,
      })
      .from(recurringTransactionOccurrences)
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, userId),
          inArray(recurringTransactionOccurrences.recurringRuleId, recurringRuleIds),
          or(
            lte(recurringTransactionOccurrences.purchaseDate, periodEnd),
            lte(recurringTransactionOccurrences.boletoPaymentDate, periodEnd),
          ),
        ),
      );

    return rows.map((row) => ({
      ...row,
      purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
      boletoPaymentDate: row.boletoPaymentDate?.toISOString().slice(0, 10) ?? null,
    }));
  },
} satisfies AccountsRepository;

export const findAccountByIdForUser = (id: string, userId: string) =>
  accountsRepository.findByIdForUser(id, userId);

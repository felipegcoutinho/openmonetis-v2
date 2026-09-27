import {
  cards,
  db,
  financialAccounts,
  installmentSeries,
  invoicePayments,
  invoices,
  recurringTransactionRules,
  transactions,
} from "@openmonetis/db";
import { and, asc, eq, inArray, isNotNull, lte, or } from "drizzle-orm";
import type { CardsRepository } from "../services/cards.service";

export const cardsRepository = {
  async accountExistsForUser(accountId, userId) {
    const [account] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
      .limit(1);
    return Boolean(account);
  },

  async insert(data) {
    const [card] = await db.insert(cards).values(data).returning();
    return card;
  },

  async deleteInactiveForUser(id, userId) {
    return db.transaction(async (transaction) => {
      const [card] = await transaction
        .select({ id: cards.id, status: cards.status })
        .from(cards)
        .where(and(eq(cards.id, id), eq(cards.userId, userId)))
        .for("update")
        .limit(1);

      if (!card) return { status: "not_found" as const };
      if (card.status !== "inactive") return { status: "active" as const };

      const payments = await transaction
        .select({ id: invoicePayments.id, transactionId: invoicePayments.transactionId })
        .from(invoicePayments)
        .where(and(eq(invoicePayments.userId, userId), eq(invoicePayments.cardId, id)));

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
              eq(transactions.cardId, id),
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
        .delete(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.userId, userId),
            eq(recurringTransactionRules.cardId, id),
          ),
        );

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
        .delete(cards)
        .where(and(eq(cards.id, id), eq(cards.userId, userId), eq(cards.status, "inactive")))
        .returning({ id: cards.id });

      return { status: "deleted" as const, id: card.id };
    });
  },

  listByUser(userId) {
    return db.select().from(cards).where(eq(cards.userId, userId)).orderBy(asc(cards.createdAt));
  },

  async findByIdForUser(id, userId) {
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
      .limit(1);
    return card ?? null;
  },

  async updateForUser(id, userId, data) {
    const [card] = await db
      .update(cards)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
      .returning();
    return card ?? null;
  },

  listMovementsByUser(userId, cardId) {
    return db
      .select({
        cardId: transactions.cardId,
        period: transactions.period,
        amount: transactions.amount,
        purchaseDate: transactions.purchaseDate,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNotNull(transactions.cardId),
          ...(cardId ? [eq(transactions.cardId, cardId)] : []),
        ),
      )
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
        })),
      );
  },

  listInvoiceStatesByUser(userId, cardId) {
    return db
      .select({
        cardId: invoices.cardId,
        period: invoices.period,
        paymentStatus: invoices.paymentStatus,
        closingDate: invoices.closingDate,
        dueDate: invoices.dueDate,
        datesCustomized: invoices.datesCustomized,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), ...(cardId ? [eq(invoices.cardId, cardId)] : [])))
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          closingDate: row.closingDate?.toISOString().slice(0, 10) ?? null,
          dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
        })),
      );
  },

  listInvoicePaymentsByUser(userId, cardId) {
    return db
      .select({
        cardId: invoicePayments.cardId,
        period: invoicePayments.period,
        amount: invoicePayments.amount,
      })
      .from(invoicePayments)
      .where(
        and(
          eq(invoicePayments.userId, userId),
          ...(cardId ? [eq(invoicePayments.cardId, cardId)] : []),
        ),
      );
  },

  async listActiveRecurringRulesThroughPeriod(userId, periodEnd, cardId) {
    const rows = await db
      .select({
        id: recurringTransactionRules.id,
        cardId: recurringTransactionRules.cardId,
        amount: recurringTransactionRules.amount,
        anchorDate: recurringTransactionRules.anchorDate,
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        dueDate: recurringTransactionRules.dueDate,
        closingDay: cards.closingDay,
        closingRuleType: cards.closingRuleType,
        closingOffsetDays: cards.closingOffsetDays,
        closingOffsetMode: cards.closingOffsetMode,
        dueDay: cards.dueDay,
      })
      .from(recurringTransactionRules)
      .innerJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          eq(recurringTransactionRules.status, "active"),
          lte(recurringTransactionRules.startDate, periodEnd),
          ...(cardId ? [eq(recurringTransactionRules.cardId, cardId)] : []),
        ),
      );

    return rows.map((row) => ({
      ...row,
      anchorDate: row.anchorDate.toISOString().slice(0, 10),
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    }));
  },
} satisfies CardsRepository;

export const findCardByIdForUser = (id: string, userId: string) =>
  cardsRepository.findByIdForUser(id, userId);

import {
  cards,
  db,
  dueDateRuleVersions,
  invoicePayments,
  invoices,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  transactions,
  user,
} from "@openmonetis/db";
import { normalizeBusinessCalendar } from "@openmonetis/domain/business-calendars";
import { isActiveRecurringOccurrence } from "@openmonetis/domain/recurring-transactions";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { DueDateRulesRepository } from "../services/due-date-rules.service";

const dateString = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
export const dueDateRulesRepository: DueDateRulesRepository = {
  async setException(userId, input, assertEditable) {
    return db.transaction(async (tx) => {
      if (input.target === "transaction") {
        const [row] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.userId, userId), eq(transactions.id, input.transactionId)))
          .for("update");
        if (!row) return false;
        assertEditable({
          target: "transaction",
          isSettled: row.isSettled === true,
          type: row.type,
          origin: row.origin,
          paymentMethod: row.paymentMethod,
          dueDate: dateString(row.dueDate),
        });
        await tx
          .update(transactions)
          .set({ dueDateRuleExcluded: input.excluded, updatedAt: new Date() })
          .where(and(eq(transactions.userId, userId), eq(transactions.id, row.id)));
        return true;
      }
      if (input.target === "recurring") {
        const [rule] = await tx
          .select()
          .from(recurringTransactionRules)
          .where(
            and(
              eq(recurringTransactionRules.userId, userId),
              eq(recurringTransactionRules.id, input.recurringRuleId),
            ),
          )
          .for("update");
        if (!rule) return false;
        const occurrenceDate = new Date(`${input.occurrenceDate}T00:00:00.000Z`);
        const [previous] = await tx
          .select()
          .from(recurringTransactionOccurrences)
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
              eq(recurringTransactionOccurrences.purchaseDate, occurrenceDate),
            ),
          )
          .for("update");
        assertEditable({
          target: "recurring",
          type: rule.type,
          paymentMethod: rule.paymentMethod,
          dueDate: dateString(rule.dueDate),
          isSettled: previous?.isSettled ?? rule.isSettled ?? false,
          validOccurrence: isActiveRecurringOccurrence(
            {
              ...rule,
              dueDate: dateString(rule.dueDate),
              anchorDate: dateString(rule.anchorDate) as string,
              startDate: dateString(rule.startDate) as string,
              endDate: dateString(rule.endDate),
              recurrenceEndDate: dateString(rule.recurrenceEndDate),
            },
            input.occurrenceDate,
          ),
        });
        await tx
          .insert(recurringTransactionOccurrences)
          .values({
            userId,
            recurringSeriesId: rule.seriesId,
            recurringRuleId: rule.id,
            purchaseDate: occurrenceDate,
            isSettled: false,
            dueDateRuleExcluded: input.excluded,
          })
          .onConflictDoUpdate({
            target: [
              recurringTransactionOccurrences.recurringSeriesId,
              recurringTransactionOccurrences.purchaseDate,
            ],
            set: { dueDateRuleExcluded: input.excluded, updatedAt: new Date() },
          });
        return true;
      }
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${input.cardId}:${input.period}`}, 0))`,
      );
      const [card] = await tx
        .select({ id: cards.id })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.id, input.cardId)));
      if (!card) return false;
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.cardId, input.cardId),
            eq(invoices.period, input.period),
          ),
        );
      const [payment] = await tx
        .select({ id: invoicePayments.id })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, userId),
            eq(invoicePayments.cardId, input.cardId),
            eq(invoicePayments.period, input.period),
          ),
        )
        .limit(1);
      assertEditable({
        target: "invoice",
        isSettled: invoice?.paymentStatus === "paid",
        hasPayments: Boolean(payment),
        datesCustomized: invoice?.datesCustomized,
      });
      await tx
        .insert(invoices)
        .values({
          userId,
          cardId: input.cardId,
          period: input.period,
          dueDateRuleExcluded: input.excluded,
        })
        .onConflictDoUpdate({
          target: [invoices.userId, invoices.cardId, invoices.period],
          set: { dueDateRuleExcluded: input.excluded, updatedAt: new Date() },
        });
      return true;
    });
  },
  async listVersions(userId) {
    const rows = await db
      .select({
        revision: dueDateRuleVersions.revision,
        effectiveFrom: dueDateRuleVersions.effectiveFrom,
        calendar: dueDateRuleVersions.calendar,
        rules: dueDateRuleVersions.rules,
      })
      .from(dueDateRuleVersions)
      .where(eq(dueDateRuleVersions.userId, userId))
      .orderBy(desc(dueDateRuleVersions.revision));
    return rows.map((row) => ({ ...row, calendar: normalizeBusinessCalendar(row.calendar) }));
  },
  async listTargets(userId) {
    const [cardRows, payableRows, recurringRows] = await Promise.all([
      db
        .select({ id: cards.id, name: cards.name })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.status, "active"))),
      db
        .select({ id: transactions.id, name: transactions.name })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, "expense"),
            ne(transactions.paymentMethod, "credit_card"),
            isNotNull(transactions.dueDate),
            eq(transactions.origin, "regular"),
          ),
        ),
      db
        .select({ id: recurringTransactionRules.seriesId, name: recurringTransactionRules.name })
        .from(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.userId, userId),
            eq(recurringTransactionRules.type, "expense"),
            ne(recurringTransactionRules.paymentMethod, "credit_card"),
            isNotNull(recurringTransactionRules.dueDate),
            eq(recurringTransactionRules.status, "active"),
          ),
        ),
    ]);
    return {
      cards: cardRows,
      transactions: payableRows,
      recurringSeries: [...new Map(recurringRows.map((row) => [row.id, row])).values()],
    };
  },
  async appendVersion(userId, input) {
    return db.transaction(async (tx) => {
      await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
      const [latest] = await tx
        .select({ revision: dueDateRuleVersions.revision })
        .from(dueDateRuleVersions)
        .where(eq(dueDateRuleVersions.userId, userId))
        .orderBy(desc(dueDateRuleVersions.revision))
        .limit(1);
      if ((latest?.revision ?? 0) !== input.revision) return null;
      const version = { ...input, revision: input.revision + 1 };
      await tx.insert(dueDateRuleVersions).values({ userId, ...version });
      return version;
    });
  },
};

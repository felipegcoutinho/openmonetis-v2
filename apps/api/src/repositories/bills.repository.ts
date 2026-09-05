import type { BillsRepository } from "../services/bills.service";
import {
  listRecurringOccurrencesForUser,
  listRecurringRulesForPeriod,
  listRecurringSplitsForUser,
  listTransactionSplitsForUser,
  listTransactionsByPeriod,
} from "./transactions.repository";

function date(value: Date) {
  return value.toISOString().slice(0, 10);
}

export const billsRepository: BillsRepository = {
  async listPersisted(userId, period) {
    const rows = await listTransactionsByPeriod(userId, period, {
      type: "expense",
      paymentMethod: "boleto",
      hasDueDate: true,
    });
    const billRows = rows.filter((row) => row.dueDate !== null);
    const splits = await listTransactionSplitsForUser(
      billRows.map((row) => row.id),
      userId,
    );
    return billRows.map((row) => ({
      id: row.id,
      purchaseDate: date(row.purchaseDate),
      name: row.name,
      amount: row.amount,
      dueDate: date(row.dueDate as Date),
      boletoPaymentDate: row.boletoPaymentDate ? date(row.boletoPaymentDate) : null,
      isSettled: row.isSettled ?? false,
      condition: row.condition,
      currentInstallment: row.currentInstallment,
      installmentCount: row.installmentCount,
      accountId: row.accountId,
      accountName: row.accountName,
      accountLogo: row.accountLogo,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      splits: splits.filter((split) => split.transactionId === row.id),
    }));
  },
  async listRecurring(userId, periodEnd) {
    const rows = await listRecurringRulesForPeriod(userId, periodEnd);
    const billRows = rows.filter(
      (row) => row.type === "expense" && row.paymentMethod === "boleto" && row.dueDate !== null,
    );
    const splits = await listRecurringSplitsForUser(
      billRows.map((row) => row.id),
      userId,
    );
    return billRows.map((row) => ({
      id: row.id,
      startDate: date(row.startDate),
      endDate: row.endDate ? date(row.endDate) : null,
      dueDate: date(row.dueDate as Date),
      frequency: row.frequency,
      name: row.name,
      amount: row.amount,
      isSettled: row.isSettled ?? false,
      accountId: row.accountId,
      accountName: row.accountName,
      accountLogo: row.accountLogo,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      personId: row.personId,
      personName: row.personName,
      personAvatarUrl: row.personAvatarUrl,
      splits: splits
        .filter((split) => split.recurringRuleId === row.id)
        .map(({ recurringRuleId: _recurringRuleId, ...split }) => split),
    }));
  },
  async listOccurrenceStates(userId, ruleIds, periodStart, periodEnd) {
    const rows = await listRecurringOccurrencesForUser(
      ruleIds,
      new Date(`${periodStart}T00:00:00.000Z`),
      new Date(`${periodEnd}T00:00:00.000Z`),
      userId,
    );
    return rows.map((row) => ({
      recurringRuleId: row.recurringRuleId,
      purchaseDate: date(row.purchaseDate),
      isSettled: row.isSettled,
      accountId: row.accountId,
      boletoPaymentDate: row.boletoPaymentDate ? date(row.boletoPaymentDate) : null,
    }));
  },
  listAccounts(userId) {
    return db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        logo: financialAccounts.logo,
      })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isArchived, false)))
      .orderBy(asc(financialAccounts.name));
  },
  async payPersisted(userId, billId, accountId, paidAt) {
    const [updated] = await db
      .update(transactions)
      .set({
        accountId,
        boletoPaymentDate: new Date(`${paidAt}T00:00:00.000Z`),
        isSettled: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactions.id, billId),
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          eq(transactions.paymentMethod, "boleto"),
          eq(transactions.isSettled, false),
        ),
      )
      .returning({ id: transactions.id });
    return Boolean(updated);
  },
  async payRecurring(userId, recurringRuleId, purchaseDate, accountId, paidAt) {
    const [updated] = await db
      .insert(recurringTransactionOccurrences)
      .values({
        userId,
        recurringRuleId,
        purchaseDate: new Date(`${purchaseDate}T00:00:00.000Z`),
        isSettled: true,
        accountId,
        boletoPaymentDate: new Date(`${paidAt}T00:00:00.000Z`),
      })
      .onConflictDoUpdate({
        target: [
          recurringTransactionOccurrences.recurringRuleId,
          recurringTransactionOccurrences.purchaseDate,
        ],
        set: {
          isSettled: true,
          accountId,
          boletoPaymentDate: new Date(`${paidAt}T00:00:00.000Z`),
          updatedAt: new Date(),
        },
      })
      .returning({ id: recurringTransactionOccurrences.id });
    return Boolean(updated);
  },
};

import {
  db,
  financialAccounts,
  recurringTransactionOccurrences,
  transactions,
} from "@openmonetis/db";
import { and, asc, eq } from "drizzle-orm";

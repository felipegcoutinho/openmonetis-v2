import {
  db,
  invoicePaymentAllocations,
  invoicePayments,
  people,
  personSettlements,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { and, asc, desc, eq, gte, isNull, lt, lte, or } from "drizzle-orm";
import type { PersonSettlementsRepository } from "../services/person-settlements.service";

const settlementColumns = {
  id: personSettlements.id,
  userId: personSettlements.userId,
  personId: personSettlements.personId,
  invoicePaymentAllocationId: personSettlements.invoicePaymentAllocationId,
  amount: personSettlements.amount,
  receivedAt: personSettlements.receivedAt,
  note: personSettlements.note,
  createdAt: personSettlements.createdAt,
};

export const personSettlementsRepository: PersonSettlementsRepository = {
  async findPersonForUser(personId, userId) {
    const [person] = await db
      .select({ id: people.id, name: people.name, role: people.role, status: people.status })
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);
    return person ?? null;
  },

  async listExternalPeopleForUser(userId) {
    return db
      .select({
        id: people.id,
        name: people.name,
        role: people.role,
        status: people.status,
        avatarUrl: people.avatarUrl,
      })
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.role, "external")))
      .orderBy(asc(people.name));
  },

  async listSettlementsForPerson(personId, userId, period) {
    const periodStart = new Date(`${period}-01T00:00:00.000Z`);
    const nextPeriodStart = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
    );

    return db
      .select(settlementColumns)
      .from(personSettlements)
      .leftJoin(
        invoicePaymentAllocations,
        and(
          eq(invoicePaymentAllocations.id, personSettlements.invoicePaymentAllocationId),
          eq(invoicePaymentAllocations.userId, userId),
        ),
      )
      .leftJoin(
        invoicePayments,
        and(
          eq(invoicePayments.id, invoicePaymentAllocations.paymentId),
          eq(invoicePayments.userId, userId),
        ),
      )
      .where(
        and(
          eq(personSettlements.personId, personId),
          eq(personSettlements.userId, userId),
          or(
            and(
              isNull(personSettlements.invoicePaymentAllocationId),
              gte(personSettlements.receivedAt, periodStart),
              lt(personSettlements.receivedAt, nextPeriodStart),
            ),
            eq(invoicePayments.period, period),
          ),
        ),
      )
      .orderBy(desc(personSettlements.receivedAt), desc(personSettlements.createdAt));
  },

  async listBalanceEntriesForPerson(personId, userId, period) {
    const rows = await db
      .select({
        kind: transactions.origin,
        amount: transactions.amount,
        splitAmount: transactionSplits.amount,
      })
      .from(transactions)
      .leftJoin(
        transactionSplits,
        and(
          eq(transactionSplits.transactionId, transactions.id),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.personId, personId),
        ),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.period, period),
          or(
            and(eq(transactions.origin, "regular"), eq(transactions.type, "expense")),
            eq(transactions.origin, "refund"),
          ),
          or(eq(transactions.personId, personId), eq(transactionSplits.personId, personId)),
        ),
      );

    return rows.map((row) => ({
      kind: row.kind === "refund" ? ("refund" as const) : ("expense" as const),
      amount: row.splitAmount ?? row.amount,
    }));
  },

  async listRecurringBalanceRulesForPeriod(userId, period) {
    const periodStart = new Date(`${period}-01T00:00:00.000Z`);
    const [year, month] = period.split("-").map(Number);
    const periodEnd = new Date(Date.UTC(year, month, 0));
    const rows = await db
      .select({
        id: recurringTransactionRules.id,
        seriesId: recurringTransactionRules.seriesId,
        personId: recurringTransactionRules.personId,
        amount: recurringTransactionRules.amount,
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        splitPersonId: recurringTransactionSplits.personId,
        splitAmount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionRules)
      .leftJoin(
        recurringTransactionSplits,
        and(
          eq(recurringTransactionSplits.recurringRuleId, recurringTransactionRules.id),
          eq(recurringTransactionSplits.userId, userId),
        ),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
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
    return [...grouped.values()].map((group) => {
      const row = group[0] as (typeof rows)[number];
      return {
        id: row.id,
        seriesId: row.seriesId,
        personId: row.personId,
        amount: row.amount,
        startDate: row.startDate.toISOString().slice(0, 10),
        endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
        frequency: row.frequency,
        splits: group.flatMap((item) =>
          item.splitPersonId && item.splitAmount !== null
            ? [{ personId: item.splitPersonId, amount: item.splitAmount }]
            : [],
        ),
      };
    });
  },

  async createSettlement(input) {
    return db.transaction(async (tx) => {
      const [person] = await tx
        .select({ id: people.id, role: people.role, status: people.status })
        .from(people)
        .where(and(eq(people.id, input.personId), eq(people.userId, input.userId)))
        .for("update")
        .limit(1);
      if (person?.role !== "external" || person.status !== "active") {
        return null;
      }
      const [settlement] = await tx
        .insert(personSettlements)
        .values({
          userId: input.userId,
          personId: input.personId,
          amount: input.amount,
          receivedAt: input.receivedAt,
          note: input.note,
        })
        .returning(settlementColumns);
      return settlement ?? null;
    });
  },

  async deleteSettlementForUser(id, userId) {
    return db.transaction(async (tx) => {
      const [settlement] = await tx
        .select(settlementColumns)
        .from(personSettlements)
        .where(
          and(
            eq(personSettlements.id, id),
            eq(personSettlements.userId, userId),
            isNull(personSettlements.invoicePaymentAllocationId),
          ),
        )
        .for("update")
        .limit(1);
      if (!settlement) return null;

      await tx
        .delete(personSettlements)
        .where(and(eq(personSettlements.id, id), eq(personSettlements.userId, userId)));
      return settlement;
    });
  },
};

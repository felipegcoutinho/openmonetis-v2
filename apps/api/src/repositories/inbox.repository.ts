import { cards, db, financialAccounts, inboxItems, transactions } from "@openmonetis/db";
import type { InboxItemStatus } from "@openmonetis/domain/inbox";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { InboxRepository } from "../services/inbox.service";

export const inboxRepository: InboxRepository = {
  async insertOrFind(draft) {
    const [inserted] = await db
      .insert(inboxItems)
      .values(draft)
      .onConflictDoNothing({ target: [inboxItems.userId, inboxItems.clientId] })
      .returning();
    if (inserted) return { record: inserted, duplicate: false };

    const [existingRecord] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.userId, draft.userId), eq(inboxItems.clientId, draft.clientId)))
      .limit(1);
    const existing = existingRecord as typeof inboxItems.$inferSelect;
    return { record: existing, duplicate: true };
  },

  async listForUser(userId, query) {
    return db.transaction(
      async (transaction) => {
        const statusWhere = and(eq(inboxItems.userId, userId), eq(inboxItems.status, query.status));
        const sourceFilteredWhere = and(
          statusWhere,
          query.sourceAppName ? eq(inboxItems.sourceAppName, query.sourceAppName) : undefined,
        );
        const notificationDate = sql<string>`((${inboxItems.notificationTimestamp} AT TIME ZONE 'America/Sao_Paulo')::date)::text`;
        const filteredWhere = and(
          sourceFilteredWhere,
          query.notificationDate ? eq(notificationDate, query.notificationDate) : undefined,
        );
        const items = await transaction
          .select()
          .from(inboxItems)
          .where(filteredWhere)
          .orderBy(
            desc(inboxItems.notificationTimestamp),
            desc(inboxItems.createdAt),
            desc(inboxItems.id),
          )
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize);
        const totalRows = await transaction
          .select({ value: count() })
          .from(inboxItems)
          .where(filteredWhere);
        const countRows = await transaction
          .select({ status: inboxItems.status, value: count() })
          .from(inboxItems)
          .where(eq(inboxItems.userId, userId))
          .groupBy(inboxItems.status);
        const sourceRows = await transaction
          .selectDistinct({ name: inboxItems.sourceAppName })
          .from(inboxItems)
          .where(and(statusWhere, isNotNull(inboxItems.sourceAppName)))
          .orderBy(asc(inboxItems.sourceAppName));
        const notificationDateRows = await transaction
          .selectDistinct({ date: notificationDate })
          .from(inboxItems)
          .where(sourceFilteredWhere)
          .orderBy(desc(notificationDate));
        const pendingAmountItems = await transaction
          .select({
            sourceAppName: inboxItems.sourceAppName,
            amount: inboxItems.parsedAmount,
          })
          .from(inboxItems)
          .where(and(eq(inboxItems.userId, userId), eq(inboxItems.status, "pending")));
        const activeCards = await transaction
          .select({ id: cards.id, name: cards.name, logo: cards.logo })
          .from(cards)
          .where(and(eq(cards.userId, userId), eq(cards.status, "active")))
          .orderBy(asc(cards.name));
        const activeAccounts = await transaction
          .select({
            id: financialAccounts.id,
            name: financialAccounts.name,
            logo: financialAccounts.logo,
          })
          .from(financialAccounts)
          .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isArchived, false)))
          .orderBy(asc(financialAccounts.name));
        const counts: Record<InboxItemStatus, number> = {
          pending: 0,
          processed: 0,
          discarded: 0,
        };
        for (const row of countRows) counts[row.status] = Number(row.value);
        return {
          items,
          sourceApps: sourceRows.map((row) => row.name as string),
          notificationDates: notificationDateRows.map((row) => row.date),
          total: Number(totalRows[0].value),
          counts,
          pendingAmountItems,
          activeCards,
          activeAccounts,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },

  async snapshotForUser(userId, limit) {
    return db.transaction(
      async (transaction) => {
        const where = and(eq(inboxItems.userId, userId), eq(inboxItems.status, "pending"));
        const items = await transaction
          .select()
          .from(inboxItems)
          .where(where)
          .orderBy(
            desc(inboxItems.notificationTimestamp),
            desc(inboxItems.createdAt),
            desc(inboxItems.id),
          )
          .limit(limit);
        const totalRows = await transaction
          .select({ value: count() })
          .from(inboxItems)
          .where(where);
        return { items, pendingCount: Number(totalRows[0].value) };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },

  async findByIdForUser(id, userId) {
    const [item] = await db
      .select()
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
      .limit(1);
    return item ?? null;
  },

  async transactionExistsForUser(transactionId, userId) {
    const [record] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);
    return Boolean(record);
  },

  async transitionForUser(input) {
    const processed = input.targetStatus === "processed";
    const discarded = input.targetStatus === "discarded";
    const [updated] = await db
      .update(inboxItems)
      .set({
        status: input.targetStatus,
        transactionId: processed ? (input.transactionId ?? null) : null,
        processedAt: processed ? input.changedAt : null,
        discardedAt: discarded ? input.changedAt : null,
        updatedAt: input.changedAt,
      })
      .where(
        and(
          eq(inboxItems.id, input.id),
          eq(inboxItems.userId, input.userId),
          eq(inboxItems.status, input.expectedStatus),
        ),
      )
      .returning();
    return updated ?? null;
  },

  async deleteForUser(id, userId) {
    const [deleted] = await db
      .delete(inboxItems)
      .where(
        and(
          eq(inboxItems.id, id),
          eq(inboxItems.userId, userId),
          sql`${inboxItems.status} <> 'pending'`,
        ),
      )
      .returning({ id: inboxItems.id });
    return Boolean(deleted);
  },

  async deleteByStatusForUser(status, userId) {
    const deleted = await db
      .delete(inboxItems)
      .where(and(eq(inboxItems.userId, userId), eq(inboxItems.status, status)))
      .returning({ id: inboxItems.id });
    return deleted.length;
  },
};

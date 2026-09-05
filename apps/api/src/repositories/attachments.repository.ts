import {
  attachments,
  categories,
  db,
  people,
  transactionAttachments,
  transactions,
} from "@openmonetis/db";
import { and, asc, desc, eq, like, lt, notExists, notLike, sql } from "drizzle-orm";
import type { AttachmentsRepository } from "../services/attachments.service";

export const attachmentsRepository = {
  async transactionExistsForUser(transactionId, userId) {
    const [row] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .limit(1);
    return Boolean(row);
  },

  async insertPending(data) {
    const [attachmentRecord] = await db.insert(attachments).values(data).returning();
    return attachmentRecord as typeof attachments.$inferSelect;
  },

  async finalizeAndAttach(uploadId, transactionId, userId, pendingKey, finalKey) {
    return db.transaction(async (transaction) => {
      const [ownedTransaction] = await transaction
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
        .limit(1);
      if (!ownedTransaction) return null;

      const [current] = await transaction
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, uploadId), eq(attachments.userId, userId)))
        .limit(1)
        .for("update");
      if (!current || (current.fileKey !== pendingKey && current.fileKey !== finalKey)) return null;

      let attachment = current;
      if (current.fileKey === pendingKey) {
        const [updatedRecord] = await transaction
          .update(attachments)
          .set({ fileKey: finalKey })
          .where(
            and(
              eq(attachments.id, uploadId),
              eq(attachments.userId, userId),
              eq(attachments.fileKey, pendingKey),
            ),
          )
          .returning();
        attachment = updatedRecord as typeof attachments.$inferSelect;
      }

      await transaction
        .insert(transactionAttachments)
        .values({
          userId,
          transactionId,
          attachmentId: attachment.id,
        })
        .onConflictDoNothing();

      return attachment;
    });
  },

  listForTransaction(transactionId, userId) {
    return db
      .select({
        id: attachments.id,
        userId: attachments.userId,
        fileKey: attachments.fileKey,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        createdAt: attachments.createdAt,
      })
      .from(transactionAttachments)
      .innerJoin(
        attachments,
        and(
          eq(transactionAttachments.attachmentId, attachments.id),
          eq(attachments.userId, userId),
        ),
      )
      .where(
        and(
          eq(transactionAttachments.transactionId, transactionId),
          eq(transactionAttachments.userId, userId),
          notLike(attachments.fileKey, "pending/%"),
          notLike(attachments.fileKey, "deleting/%"),
        ),
      )
      .orderBy(desc(attachments.createdAt), asc(attachments.id));
  },

  listLinksForPeriod(userId, period) {
    return db
      .select({
        id: attachments.id,
        userId: attachments.userId,
        fileKey: attachments.fileKey,
        fileName: attachments.fileName,
        fileSize: attachments.fileSize,
        mimeType: attachments.mimeType,
        createdAt: attachments.createdAt,
        transactionId: transactions.id,
        transactionName: transactions.name,
        transactionAmount: transactions.amount,
        transactionType: transactions.type,
        purchaseDate: transactions.purchaseDate,
        transactionPeriod: transactions.period,
        personId: people.id,
        personName: people.name,
        personAvatarUrl: people.avatarUrl,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        linkedTransactionCount: sql<number>`(
          select count(*)::int
          from ${transactionAttachments}
          where ${transactionAttachments.attachmentId} = ${attachments.id}
            and ${transactionAttachments.userId} = ${userId}
        )`,
      })
      .from(transactionAttachments)
      .innerJoin(
        attachments,
        and(
          eq(transactionAttachments.attachmentId, attachments.id),
          eq(attachments.userId, userId),
        ),
      )
      .innerJoin(
        transactions,
        and(
          eq(transactionAttachments.transactionId, transactions.id),
          eq(transactions.userId, userId),
          eq(transactions.period, period),
        ),
      )
      .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
      .leftJoin(
        categories,
        and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .where(
        and(
          eq(transactionAttachments.userId, userId),
          notLike(attachments.fileKey, "pending/%"),
          notLike(attachments.fileKey, "deleting/%"),
        ),
      )
      .orderBy(desc(transactions.purchaseDate), desc(attachments.createdAt), asc(transactions.id));
  },

  async findForUser(id, userId) {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
      .limit(1);
    return attachment ?? null;
  },

  async detachFromTransactionForUser(transactionId, attachmentId, userId) {
    return db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, attachmentId), eq(attachments.userId, userId)))
        .limit(1)
        .for("update");
      if (
        !current ||
        current.fileKey.startsWith("pending/") ||
        current.fileKey.startsWith("deleting/")
      ) {
        return null;
      }

      const [linked] = await transaction
        .select({ attachmentId: transactionAttachments.attachmentId })
        .from(transactionAttachments)
        .innerJoin(
          transactions,
          and(
            eq(transactionAttachments.transactionId, transactions.id),
            eq(transactions.userId, userId),
          ),
        )
        .where(
          and(
            eq(transactionAttachments.transactionId, transactionId),
            eq(transactionAttachments.attachmentId, attachmentId),
            eq(transactionAttachments.userId, userId),
          ),
        )
        .limit(1);

      if (!linked) return null;

      await transaction
        .delete(transactionAttachments)
        .where(
          and(
            eq(transactionAttachments.transactionId, transactionId),
            eq(transactionAttachments.attachmentId, attachmentId),
            eq(transactionAttachments.userId, userId),
          ),
        );

      const [remainingLink] = await transaction
        .select({ attachmentId: transactionAttachments.attachmentId })
        .from(transactionAttachments)
        .where(
          and(
            eq(transactionAttachments.attachmentId, attachmentId),
            eq(transactionAttachments.userId, userId),
          ),
        )
        .limit(1);
      const orphaned = !remainingLink;

      if (orphaned) {
        const tombstoneKey = toDeletionKey(current.fileKey);
        const [tombstoneRecord] = await transaction
          .update(attachments)
          .set({ fileKey: tombstoneKey })
          .where(
            and(
              eq(attachments.id, attachmentId),
              eq(attachments.userId, userId),
              eq(attachments.fileKey, current.fileKey),
            ),
          )
          .returning();
        return {
          attachment: tombstoneRecord as typeof attachments.$inferSelect,
          orphaned: true,
        };
      }

      return { attachment: current, orphaned: false };
    });
  },

  async markForDeletionForUser(id, userId) {
    return db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
        .limit(1)
        .for("update");
      if (!current) return null;

      await transaction
        .delete(transactionAttachments)
        .where(
          and(
            eq(transactionAttachments.attachmentId, id),
            eq(transactionAttachments.userId, userId),
          ),
        );
      if (current.fileKey.startsWith("deleting/")) return current;

      const [tombstoneRecord] = await transaction
        .update(attachments)
        .set({ fileKey: toDeletionKey(current.fileKey) })
        .where(
          and(
            eq(attachments.id, id),
            eq(attachments.userId, userId),
            eq(attachments.fileKey, current.fileKey),
          ),
        )
        .returning();
      return tombstoneRecord as typeof attachments.$inferSelect;
    });
  },

  async markPendingForDeletionForUser(uploadId, userId, pendingKey) {
    return db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, uploadId), eq(attachments.userId, userId)))
        .limit(1)
        .for("update");
      if (!current || current.fileKey !== pendingKey) return null;

      const [linked] = await transaction
        .select({ attachmentId: transactionAttachments.attachmentId })
        .from(transactionAttachments)
        .where(
          and(
            eq(transactionAttachments.attachmentId, uploadId),
            eq(transactionAttachments.userId, userId),
          ),
        )
        .limit(1);
      if (linked) return null;

      const [attachmentRecord] = await transaction
        .update(attachments)
        .set({ fileKey: toDeletionKey(pendingKey) })
        .where(
          and(
            eq(attachments.id, uploadId),
            eq(attachments.userId, userId),
            eq(attachments.fileKey, pendingKey),
          ),
        )
        .returning();
      return attachmentRecord as typeof attachments.$inferSelect;
    });
  },

  async markOrphansForDeletionForUser(userId) {
    return db
      .update(attachments)
      .set({ fileKey: sql<string>`'deleting/' || ${attachments.fileKey}` })
      .where(
        and(
          eq(attachments.userId, userId),
          notLike(attachments.fileKey, "pending/%"),
          notLike(attachments.fileKey, "deleting/%"),
          notExists(
            db
              .select({ attachmentId: transactionAttachments.attachmentId })
              .from(transactionAttachments)
              .where(
                and(
                  eq(transactionAttachments.attachmentId, attachments.id),
                  eq(transactionAttachments.userId, userId),
                ),
              ),
          ),
        ),
      )
      .returning();
  },

  async markExpiredPendingForDeletionForUser(userId, olderThan) {
    return db
      .update(attachments)
      .set({ fileKey: sql<string>`'deleting/' || ${attachments.fileKey}` })
      .where(
        and(
          eq(attachments.userId, userId),
          like(attachments.fileKey, "pending/%"),
          lt(attachments.createdAt, olderThan),
          notExists(
            db
              .select({ attachmentId: transactionAttachments.attachmentId })
              .from(transactionAttachments)
              .where(
                and(
                  eq(transactionAttachments.attachmentId, attachments.id),
                  eq(transactionAttachments.userId, userId),
                ),
              ),
          ),
        ),
      )
      .returning();
  },

  listDeletionTombstonesForUser(userId) {
    return db
      .select()
      .from(attachments)
      .where(and(eq(attachments.userId, userId), like(attachments.fileKey, "deleting/%")))
      .orderBy(asc(attachments.createdAt), asc(attachments.id));
  },

  async deleteDeletionTombstoneForUser(id, userId, tombstoneKey) {
    const [attachment] = await db
      .delete(attachments)
      .where(
        and(
          eq(attachments.id, id),
          eq(attachments.userId, userId),
          eq(attachments.fileKey, tombstoneKey),
          notExists(
            db
              .select({ attachmentId: transactionAttachments.attachmentId })
              .from(transactionAttachments)
              .where(
                and(
                  eq(transactionAttachments.attachmentId, attachments.id),
                  eq(transactionAttachments.userId, userId),
                ),
              ),
          ),
        ),
      )
      .returning();
    return attachment ?? null;
  },
} satisfies AttachmentsRepository;

function toDeletionKey(fileKey: string) {
  return `deleting/${fileKey}`;
}

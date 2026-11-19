import {
  attachments,
  categories,
  db,
  noteAttachments,
  notes,
  people,
  transactionAttachments,
  transactions,
} from "@openmonetis/db";
import { and, asc, desc, eq, like, lt, notExists, notLike, type SQL, sql } from "drizzle-orm";
import type { AttachmentsRepository } from "../services/attachments.service";
import { categoryLabelSql } from "./categories.repository";

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

      const attachment = await promoteUpload(transaction, uploadId, userId, pendingKey, finalKey);
      if (!attachment) return null;

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

  async findNoteStateForUser(noteId, userId) {
    const [row] = await db
      .select({ isArchived: notes.isArchived })
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async finalizeAndAttachToNote(uploadId, noteId, userId, pendingKey, finalKey) {
    return db.transaction(async (transaction) => {
      const [ownedNote] = await transaction
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId), eq(notes.isArchived, false)))
        .limit(1);
      if (!ownedNote) return null;

      const attachment = await promoteUpload(transaction, uploadId, userId, pendingKey, finalKey);
      if (!attachment) return null;

      await transaction
        .insert(noteAttachments)
        .values({ userId, noteId, attachmentId: attachment.id })
        .onConflictDoNothing();

      return attachment;
    });
  },

  listForNote(noteId, userId) {
    return db
      .select(attachmentColumns)
      .from(noteAttachments)
      .innerJoin(
        attachments,
        and(eq(noteAttachments.attachmentId, attachments.id), eq(attachments.userId, userId)),
      )
      .where(
        and(
          eq(noteAttachments.noteId, noteId),
          eq(noteAttachments.userId, userId),
          notLike(attachments.fileKey, "pending/%"),
          notLike(attachments.fileKey, "deleting/%"),
        ),
      )
      .orderBy(asc(noteAttachments.createdAt), asc(attachments.id));
  },

  async detachFromNoteForUser(noteId, attachmentId, userId) {
    return db.transaction(async (transaction) => {
      const current = await lockActiveAttachment(transaction, attachmentId, userId);
      if (!current) return null;

      const [linked] = await transaction
        .delete(noteAttachments)
        .where(
          and(
            eq(noteAttachments.noteId, noteId),
            eq(noteAttachments.attachmentId, attachmentId),
            eq(noteAttachments.userId, userId),
          ),
        )
        .returning({ attachmentId: noteAttachments.attachmentId });
      if (!linked) return null;

      return tombstoneIfOrphaned(transaction, current, userId);
    });
  },

  listForTransaction(transactionId, userId) {
    return db
      .select(attachmentColumns)
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
        categoryName: categoryLabelSql(categories),
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
      const current = await lockActiveAttachment(transaction, attachmentId, userId);
      if (!current) return null;

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

      return tombstoneIfOrphaned(transaction, current, userId);
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
      await transaction
        .delete(noteAttachments)
        .where(and(eq(noteAttachments.attachmentId, id), eq(noteAttachments.userId, userId)));
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
      if (await isLinked(transaction, uploadId, userId)) return null;

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
          ...hasNoLinks(userId),
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
          ...hasNoLinks(userId),
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
          ...hasNoLinks(userId),
        ),
      )
      .returning();
    return attachment ?? null;
  },
} satisfies AttachmentsRepository;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AttachmentRow = typeof attachments.$inferSelect;

const attachmentColumns = {
  id: attachments.id,
  userId: attachments.userId,
  fileKey: attachments.fileKey,
  fileName: attachments.fileName,
  fileSize: attachments.fileSize,
  mimeType: attachments.mimeType,
  createdAt: attachments.createdAt,
};

function toDeletionKey(fileKey: string) {
  return `deleting/${fileKey}`;
}

/** An attachment is orphaned only when no transaction and no note references it. */
function hasNoLinks(userId: string): SQL[] {
  return [
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
    notExists(
      db
        .select({ attachmentId: noteAttachments.attachmentId })
        .from(noteAttachments)
        .where(
          and(eq(noteAttachments.attachmentId, attachments.id), eq(noteAttachments.userId, userId)),
        ),
    ),
  ];
}

async function isLinked(transaction: DatabaseTransaction, attachmentId: string, userId: string) {
  const [transactionLink] = await transaction
    .select({ attachmentId: transactionAttachments.attachmentId })
    .from(transactionAttachments)
    .where(
      and(
        eq(transactionAttachments.attachmentId, attachmentId),
        eq(transactionAttachments.userId, userId),
      ),
    )
    .limit(1);
  if (transactionLink) return true;

  const [noteLink] = await transaction
    .select({ attachmentId: noteAttachments.attachmentId })
    .from(noteAttachments)
    .where(and(eq(noteAttachments.attachmentId, attachmentId), eq(noteAttachments.userId, userId)))
    .limit(1);
  return Boolean(noteLink);
}

async function promoteUpload(
  transaction: DatabaseTransaction,
  uploadId: string,
  userId: string,
  pendingKey: string,
  finalKey: string,
) {
  const [current] = await transaction
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, uploadId), eq(attachments.userId, userId)))
    .limit(1)
    .for("update");
  if (!current || (current.fileKey !== pendingKey && current.fileKey !== finalKey)) return null;
  if (current.fileKey === finalKey) return current;

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
  return updatedRecord as AttachmentRow;
}

async function lockActiveAttachment(
  transaction: DatabaseTransaction,
  attachmentId: string,
  userId: string,
) {
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
  return current;
}

async function tombstoneIfOrphaned(
  transaction: DatabaseTransaction,
  current: AttachmentRow,
  userId: string,
) {
  if (await isLinked(transaction, current.id, userId)) {
    return { attachment: current, orphaned: false };
  }

  const [tombstoneRecord] = await transaction
    .update(attachments)
    .set({ fileKey: toDeletionKey(current.fileKey) })
    .where(
      and(
        eq(attachments.id, current.id),
        eq(attachments.userId, userId),
        eq(attachments.fileKey, current.fileKey),
      ),
    )
    .returning();
  return { attachment: tombstoneRecord as AttachmentRow, orphaned: true };
}

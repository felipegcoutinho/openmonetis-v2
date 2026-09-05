import { db, noteItems, notes } from "@openmonetis/db";
import { noteItemsMaximumCount } from "@openmonetis/domain/notes";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type {
  NoteAggregateRecord,
  NoteItemRecord,
  NoteListFilters,
  NoteRecord,
  NotesRepository,
} from "../services/notes.service";

export const notesRepository = {
  async insertAggregate(draft) {
    return db.transaction(async (transaction) => {
      const [note] = await transaction.insert(notes).values(draft.note).returning();
      const items = draft.items.length
        ? await transaction
            .insert(noteItems)
            .values(
              draft.items.map((item) => ({
                ...(item.id ? { id: item.id } : {}),
                userId: note.userId,
                noteId: note.id,
                text: item.text,
                isCompleted: item.isCompleted,
                position: item.position,
              })),
            )
            .returning()
        : [];

      return aggregate(note, items);
    });
  },

  async listByUser(userId, filters) {
    return db.transaction(
      async (transaction) => {
        const where = buildListWhere(userId, filters);
        const noteRows = await transaction
          .select()
          .from(notes)
          .where(where)
          .orderBy(desc(notes.updatedAt), desc(notes.id))
          .limit(filters.limit)
          .offset(filters.offset);
        const totals = await transaction.select({ value: count() }).from(notes).where(where);
        const noteIds = noteRows.map((note) => note.id);
        const itemRows = noteIds.length
          ? await transaction
              .select()
              .from(noteItems)
              .where(and(eq(noteItems.userId, userId), inArray(noteItems.noteId, noteIds)))
              .orderBy(asc(noteItems.position))
          : [];
        const itemsByNoteId = groupItems(itemRows);

        return {
          aggregates: noteRows.map((note) => aggregate(note, itemsByNoteId.get(note.id) ?? [])),
          total: (totals[0] as { value: number }).value,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },

  async findByIdForUser(id, userId) {
    return db.transaction(
      async (transaction) => {
        const [note] = await transaction
          .select()
          .from(notes)
          .where(and(eq(notes.id, id), eq(notes.userId, userId)))
          .limit(1);
        if (!note) return null;

        const items = await transaction
          .select()
          .from(noteItems)
          .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)))
          .orderBy(asc(noteItems.position));
        return aggregate(note, items);
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },

  async replaceForUser(id, userId, expectedVersion, draft) {
    return db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .limit(1)
        .for("update");
      if (!current) return { status: "not_found" as const };
      if (current.version !== expectedVersion || current.isArchived) {
        return { status: "version_conflict" as const };
      }

      const currentItems = await transaction
        .select()
        .from(noteItems)
        .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)));
      const currentItemsById = new Map(currentItems.map((item) => [item.id, item]));
      const incomingIds = draft.items.flatMap((item) => (item.id ? [item.id] : []));
      if (incomingIds.some((itemId) => !currentItemsById.has(itemId))) {
        return { status: "invalid_item_ids" as const };
      }

      const now = new Date();
      const [updatedRecord] = await transaction
        .update(notes)
        .set({
          title: draft.note.title,
          content: draft.note.content,
          version: sql`${notes.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(notes.id, id),
            eq(notes.userId, userId),
            eq(notes.version, expectedVersion),
            eq(notes.isArchived, false),
          ),
        )
        .returning();
      const updated = updatedRecord as NoteRecord;

      await transaction
        .update(noteItems)
        .set({ position: sql`${noteItems.position} + ${noteItemsMaximumCount}` })
        .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)));

      if (incomingIds.length > 0) {
        await transaction
          .delete(noteItems)
          .where(
            and(
              eq(noteItems.noteId, id),
              eq(noteItems.userId, userId),
              notInArray(noteItems.id, incomingIds),
            ),
          );
      } else {
        await transaction
          .delete(noteItems)
          .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)));
      }

      for (const item of draft.items) {
        if (!item.id) continue;
        await transaction
          .update(noteItems)
          .set({
            text: item.text,
            isCompleted: item.isCompleted,
            position: item.position,
            updatedAt: now,
          })
          .where(
            and(eq(noteItems.id, item.id), eq(noteItems.noteId, id), eq(noteItems.userId, userId)),
          );
      }

      const newItems = draft.items.filter((item) => !item.id);
      if (newItems.length > 0) {
        await transaction.insert(noteItems).values(
          newItems.map((item) => ({
            userId,
            noteId: id,
            text: item.text,
            isCompleted: item.isCompleted,
            position: item.position,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }

      const items = await transaction
        .select()
        .from(noteItems)
        .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)))
        .orderBy(asc(noteItems.position));

      return { status: "updated" as const, aggregate: aggregate(updated, items) };
    });
  },

  async setArchivedForUser(id, userId, expectedVersion, isArchived) {
    return db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(notes)
        .set({
          isArchived,
          version: sql`${notes.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(notes.id, id), eq(notes.userId, userId), eq(notes.version, expectedVersion)))
        .returning();
      if (!updated) {
        const [current] = await transaction
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.id, id), eq(notes.userId, userId)))
          .limit(1);
        return { status: current ? ("version_conflict" as const) : ("not_found" as const) };
      }

      const items = await transaction
        .select()
        .from(noteItems)
        .where(and(eq(noteItems.noteId, id), eq(noteItems.userId, userId)))
        .orderBy(asc(noteItems.position));
      return { status: "updated" as const, aggregate: aggregate(updated, items) };
    });
  },

  async setItemCompletionForUser(noteId, itemId, userId, expectedVersion, isCompleted) {
    return db.transaction(async (transaction) => {
      const [currentItem] = await transaction
        .select({ id: noteItems.id })
        .from(noteItems)
        .where(
          and(eq(noteItems.id, itemId), eq(noteItems.noteId, noteId), eq(noteItems.userId, userId)),
        )
        .limit(1)
        .for("update");
      if (!currentItem) return { status: "item_not_found" as const };

      const now = new Date();
      const [updatedNote] = await transaction
        .update(notes)
        .set({ version: sql`${notes.version} + 1`, updatedAt: now })
        .where(
          and(
            eq(notes.id, noteId),
            eq(notes.userId, userId),
            eq(notes.version, expectedVersion),
            eq(notes.isArchived, false),
          ),
        )
        .returning();
      if (!updatedNote) {
        return { status: "version_conflict" as const };
      }

      await transaction
        .update(noteItems)
        .set({ isCompleted, updatedAt: now })
        .where(
          and(eq(noteItems.id, itemId), eq(noteItems.noteId, noteId), eq(noteItems.userId, userId)),
        );
      const items = await transaction
        .select()
        .from(noteItems)
        .where(and(eq(noteItems.noteId, noteId), eq(noteItems.userId, userId)))
        .orderBy(asc(noteItems.position));

      return {
        status: "updated" as const,
        aggregate: aggregate(updatedNote, items),
      };
    });
  },

  async deleteForUser(id, userId, expectedVersion) {
    return db.transaction(async (transaction) => {
      const [deleted] = await transaction
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId), eq(notes.version, expectedVersion)))
        .returning({ id: notes.id });
      if (deleted) return { status: "deleted" as const, id: deleted.id };

      const [current] = await transaction
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .limit(1);
      return { status: current ? ("version_conflict" as const) : ("not_found" as const) };
    });
  },
} satisfies NotesRepository;

function buildListWhere(userId: string, filters: NoteListFilters) {
  const conditions = [eq(notes.userId, userId)];
  if (filters.status !== "all") {
    conditions.push(eq(notes.isArchived, filters.status === "archived"));
  }
  if (filters.kind) conditions.push(eq(notes.kind, filters.kind));
  if (filters.q) {
    const escapedQuery = filters.q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;
    const matchingItem = db
      .select({ id: noteItems.id })
      .from(noteItems)
      .where(
        and(
          eq(noteItems.noteId, notes.id),
          eq(noteItems.userId, userId),
          ilike(noteItems.text, pattern),
        ),
      );
    const searchCondition = or(
      ilike(notes.title, pattern),
      ilike(notes.content, pattern),
      exists(matchingItem),
    );
    conditions.push(searchCondition as NonNullable<typeof searchCondition>);
  }
  return and(...conditions);
}

function groupItems(items: NoteItemRecord[]) {
  const itemsByNoteId = new Map<string, NoteItemRecord[]>();
  for (const item of items) {
    const grouped = itemsByNoteId.get(item.noteId) ?? [];
    grouped.push(item);
    itemsByNoteId.set(item.noteId, grouped);
  }
  return itemsByNoteId;
}

function aggregate(note: NoteRecord, items: NoteItemRecord[]): NoteAggregateRecord {
  return { note, items };
}

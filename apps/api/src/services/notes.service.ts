import {
  calculateChecklistProgress,
  createNoteAggregateDraft,
  type NoteAggregateDraft,
  type NoteKind,
  NoteRuleError,
  replaceNoteAggregateDraft,
  sortNoteItemsByCompletion,
} from "@openmonetis/domain/notes";
import type {
  ArchiveNoteInput,
  CreateNoteInput,
  ListNotesQuery,
  NoteOutput,
  ReplaceNoteInput,
  SetNoteItemCompletionInput,
  SetTaskCompletionInput,
} from "@openmonetis/validators/notes";
import { badRequest, conflict, notFound } from "../utils/errors";

export type NoteRecord = {
  id: string;
  userId: string;
  title: string;
  kind: NoteKind;
  content: string | null;
  dueDate: Date | null;
  isCompleted: boolean;
  isArchived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteItemRecord = {
  id: string;
  userId: string;
  noteId: string;
  text: string;
  isCompleted: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteAggregateRecord = {
  note: NoteRecord;
  items: NoteItemRecord[];
};

export type NoteListFilters = {
  status: ListNotesQuery["status"];
  kind?: NoteKind;
  q?: string;
  limit: number;
  offset: number;
};

type ReplaceNoteResult =
  | { status: "updated"; aggregate: NoteAggregateRecord }
  | { status: "not_found" | "version_conflict" | "invalid_item_ids" };

type NoteStateMutationResult =
  | { status: "updated"; aggregate: NoteAggregateRecord }
  | { status: "not_found" | "version_conflict" };

type NoteItemMutationResult =
  | { status: "updated"; aggregate: NoteAggregateRecord }
  | { status: "note_not_found" | "item_not_found" | "version_conflict" };

type DeleteNoteResult =
  | { status: "deleted"; id: string }
  | { status: "not_found" | "version_conflict" };

export type NotesRepository = {
  insertAggregate(draft: NoteAggregateDraft): Promise<NoteAggregateRecord>;
  listByUser(
    userId: string,
    filters: NoteListFilters,
  ): Promise<{ aggregates: NoteAggregateRecord[]; total: number }>;
  findByIdForUser(id: string, userId: string): Promise<NoteAggregateRecord | null>;
  replaceForUser(
    id: string,
    userId: string,
    expectedVersion: number,
    draft: NoteAggregateDraft,
  ): Promise<ReplaceNoteResult>;
  setArchivedForUser(
    id: string,
    userId: string,
    expectedVersion: number,
    isArchived: boolean,
  ): Promise<NoteStateMutationResult>;
  setItemCompletionForUser(
    noteId: string,
    itemId: string,
    userId: string,
    expectedVersion: number,
    isCompleted: boolean,
  ): Promise<NoteItemMutationResult>;
  setTaskCompletionForUser(
    id: string,
    userId: string,
    expectedVersion: number,
    isCompleted: boolean,
  ): Promise<NoteStateMutationResult>;
  listPendingTasksDueBy(userId: string, dueBy: string): Promise<NoteRecord[]>;
  deleteForUser(id: string, userId: string, expectedVersion: number): Promise<DeleteNoteResult>;
};

export function createNotesService(repository: NotesRepository) {
  return {
    async list(userId: string, query: ListNotesQuery) {
      const page = await repository.listByUser(userId, query);

      return {
        items: page.aggregates.map(toNoteOutput),
        total: page.total,
        hasMore: query.offset + page.aggregates.length < page.total,
      };
    },

    async get(id: string, userId: string) {
      return toNoteOutput(await findNote(id, userId, repository));
    },

    async create(input: CreateNoteInput, userId: string) {
      try {
        const draft = createNoteAggregateDraft({ userId, ...input });
        return toNoteOutput(await repository.insertAggregate(draft));
      } catch (error) {
        throw translateRuleError(error);
      }
    },

    async replace(id: string, input: ReplaceNoteInput, userId: string) {
      const current = await findNote(id, userId, repository);
      assertEditable(current);

      let draft: NoteAggregateDraft;
      try {
        if (input.kind === "text") {
          draft = replaceNoteAggregateDraft({
            userId,
            currentKind: current.note.kind,
            kind: input.kind,
            title: input.title,
            content: input.content,
          });
        } else if (input.kind === "checklist") {
          draft = replaceNoteAggregateDraft({
            userId,
            currentKind: current.note.kind,
            kind: input.kind,
            title: input.title,
            items: input.items,
          });
        } else {
          draft = replaceNoteAggregateDraft({
            userId,
            currentKind: current.note.kind,
            kind: input.kind,
            title: input.title,
            content: input.content,
            dueDate: input.dueDate,
            isCompleted: input.isCompleted,
          });
        }
      } catch (error) {
        throw translateRuleError(error);
      }

      const result = await repository.replaceForUser(id, userId, input.expectedVersion, draft);
      if (result.status === "updated") return toNoteOutput(result.aggregate);
      if (result.status === "invalid_item_ids") {
        throw badRequest("One or more checklist items are invalid", "invalid_note_items");
      }
      if (result.status === "version_conflict") throw noteVersionConflict();
      throw noteNotFound();
    },

    async archive(id: string, input: ArchiveNoteInput, userId: string) {
      const current = await findNote(id, userId, repository);
      if (current.note.isArchived === input.isArchived) return toNoteOutput(current);

      const result = await repository.setArchivedForUser(
        id,
        userId,
        current.note.version,
        input.isArchived,
      );
      if (result.status === "updated") return toNoteOutput(result.aggregate);
      if (result.status === "version_conflict") throw noteVersionConflict();
      throw noteNotFound();
    },

    async setItemCompletion(
      noteId: string,
      itemId: string,
      input: SetNoteItemCompletionInput,
      userId: string,
    ) {
      const current = await findNote(noteId, userId, repository);
      assertEditable(current);
      const item = current.items.find((candidate) => candidate.id === itemId);
      if (!item) throw notFound("Note item not found", "note_item_not_found");
      if (item.isCompleted === input.isCompleted) return toNoteOutput(current);

      const result = await repository.setItemCompletionForUser(
        noteId,
        itemId,
        userId,
        current.note.version,
        input.isCompleted,
      );
      if (result.status === "updated") return toNoteOutput(result.aggregate);
      if (result.status === "version_conflict") throw noteVersionConflict();
      if (result.status === "item_not_found") {
        throw notFound("Note item not found", "note_item_not_found");
      }
      throw noteNotFound();
    },

    async setTaskCompletion(id: string, input: SetTaskCompletionInput, userId: string) {
      const current = await findNote(id, userId, repository);
      assertEditable(current);
      if (current.note.kind !== "task") {
        throw badRequest("Only task notes can be completed", "note_kind_mismatch");
      }
      if (current.note.isCompleted === input.isCompleted) return toNoteOutput(current);

      const result = await repository.setTaskCompletionForUser(
        id,
        userId,
        current.note.version,
        input.isCompleted,
      );
      if (result.status === "updated") return toNoteOutput(result.aggregate);
      if (result.status === "version_conflict") throw noteVersionConflict();
      throw noteNotFound();
    },

    async listTaskReminders(userId: string, dueBy: string) {
      return (await repository.listPendingTasksDueBy(userId, dueBy)).map((note) => ({
        id: note.id,
        title: note.title,
        dueDate: (note.dueDate as Date).toISOString().slice(0, 10),
        updatedAt: note.updatedAt.toISOString(),
      }));
    },

    async remove(id: string, expectedVersion: number, userId: string) {
      const result = await repository.deleteForUser(id, userId, expectedVersion);
      if (result.status === "deleted") return { id: result.id };
      if (result.status === "version_conflict") throw noteVersionConflict();
      throw noteNotFound();
    },
  };
}

async function findNote(id: string, userId: string, repository: NotesRepository) {
  const note = await repository.findByIdForUser(id, userId);
  if (!note) throw noteNotFound();
  return note;
}

function assertEditable(aggregate: NoteAggregateRecord) {
  if (aggregate.note.isArchived) {
    throw badRequest(
      "Archived notes must be restored before they can be changed",
      "archived_note_read_only",
    );
  }
}

function translateRuleError(error: unknown) {
  if (error instanceof NoteRuleError) return badRequest(error.message, error.code);
  return error;
}

function noteNotFound() {
  return notFound("Note not found", "note_not_found");
}

function noteVersionConflict() {
  return conflict(
    "The note changed after it was opened. Reload it and try again",
    "note_version_conflict",
  );
}

function toNoteOutput(aggregate: NoteAggregateRecord): NoteOutput {
  const items = sortNoteItemsByCompletion(aggregate.items).map((item) => ({
    id: item.id,
    text: item.text,
    isCompleted: item.isCompleted,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
  const progress = calculateChecklistProgress(items);

  return {
    id: aggregate.note.id,
    title: aggregate.note.title,
    kind: aggregate.note.kind,
    content: aggregate.note.content,
    dueDate: aggregate.note.dueDate?.toISOString().slice(0, 10) ?? null,
    isCompleted: aggregate.note.isCompleted,
    isArchived: aggregate.note.isArchived,
    items,
    ...progress,
    version: aggregate.note.version,
    createdAt: aggregate.note.createdAt.toISOString(),
    updatedAt: aggregate.note.updatedAt.toISOString(),
  };
}

export type NotesService = ReturnType<typeof createNotesService>;

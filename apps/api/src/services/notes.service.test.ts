import assert from "node:assert/strict";
import test from "node:test";
import { sortNoteItemsByCompletion } from "@openmonetis/domain/notes";
import { buildNotifications } from "@openmonetis/domain/notifications";
import {
  createNotesService,
  type NoteAggregateRecord,
  type NotesRepository,
} from "./notes.service";

const userId = "10000000-0000-4000-8000-000000000001";
const noteId = "20000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-10T12:00:00.000Z");

function taskAggregate(overrides: Partial<NoteAggregateRecord["note"]> = {}): NoteAggregateRecord {
  return {
    note: {
      id: noteId,
      userId,
      title: "Entregar relatório",
      kind: "task",
      content: null,
      dueDate: new Date("2026-09-11T00:00:00.000Z"),
      isCompleted: false,
      isArchived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    items: [],
  };
}

function repository(overrides: Partial<NotesRepository> = {}): NotesRepository {
  return {
    insertAggregate: async () => taskAggregate(),
    listByUser: async () => ({ aggregates: [], total: 0 }),
    findByIdForUser: async () => taskAggregate(),
    replaceForUser: async () => ({ status: "updated", aggregate: taskAggregate() }),
    setArchivedForUser: async () => ({ status: "updated", aggregate: taskAggregate() }),
    setItemCompletionForUser: async () => ({ status: "item_not_found" }),
    setTaskCompletionForUser: async () => ({
      status: "updated",
      aggregate: taskAggregate({ isCompleted: true, version: 2 }),
    }),
    listPendingTasksDueBy: async () => [taskAggregate().note],
    deleteForUser: async () => ({ status: "deleted", id: noteId }),
    ...overrides,
  };
}

test("note lists keep pending checklist items before completed items", () => {
  const items = sortNoteItemsByCompletion([
    { position: 0, isCompleted: true, text: "feito" },
    { position: 1, isCompleted: false, text: "pendente" },
    { position: 2, isCompleted: true, text: "feito depois" },
  ]);

  assert.deepEqual(
    items.map((item) => item.text),
    ["pendente", "feito", "feito depois"],
  );
});

test("task notes persist an owned due date and can be completed", async () => {
  let receivedUserId = "";
  let receivedDueDate = "";
  const service = createNotesService(
    repository({
      insertAggregate: async (draft) => {
        receivedUserId = draft.note.userId;
        receivedDueDate = draft.note.dueDate ?? "";
        return taskAggregate();
      },
    }),
  );

  const created = await service.create(
    { kind: "task", title: "Entregar relatório", content: null, dueDate: "2026-09-11" },
    userId,
  );
  const completed = await service.setTaskCompletion(noteId, { isCompleted: true }, userId);

  assert.equal(receivedUserId, userId);
  assert.equal(receivedDueDate, "2026-09-11");
  assert.equal(created.dueDate, "2026-09-11");
  assert.equal(completed.isCompleted, true);
});

test("pending tasks due soon appear in the attention center", () => {
  const notifications = buildNotifications({
    today: "2026-09-10",
    dueSoonDays: 3,
    sources: {
      bills: [],
      invoices: [],
      budgets: [],
      inbox: { pendingCount: 0, latestItemAt: null },
      externalExpenses: {
        pendingCount: 0,
        totalAmount: 0,
        counterpartCount: 0,
        latestCounterpartName: null,
        latestUpdatedAt: null,
        latestPeriod: null,
      },
      tasks: [
        {
          id: noteId,
          title: "Entregar relatório",
          dueDate: "2026-09-11",
          updatedAt: now.toISOString(),
        },
      ],
    },
    states: [],
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.kind, "task");
  assert.equal(notifications[0]?.severity, "warning");
});

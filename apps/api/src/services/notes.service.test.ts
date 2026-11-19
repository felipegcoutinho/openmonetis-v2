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
    attachmentCount: 0,
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
    listTasksDueBetween: async () => [taskAggregate().note],
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

for (const status of ["not_found", "version_conflict", "invalid_item_ids"] as const)
  test(`replacing a note translates ${status} and forwards ownership and expected version`, async () => {
    const calls: unknown[][] = [];
    const service = createNotesService(
      repository({
        replaceForUser: async (...args) => {
          calls.push(args);
          return { status };
        },
      }),
    );
    await assert.rejects(
      service.replace(
        noteId,
        {
          kind: "task",
          title: "Updated",
          content: null,
          dueDate: "2026-09-12",
          isCompleted: false,
          expectedVersion: 1,
        },
        userId,
      ),
      {
        code:
          status === "not_found"
            ? "note_not_found"
            : status === "version_conflict"
              ? "note_version_conflict"
              : "invalid_note_items",
      },
    );
    assert.deepEqual(calls[0].slice(0, 3), [noteId, userId, 1]);
  });

for (const operation of ["replace", "setTaskCompletion", "setItemCompletion"] as const)
  test(`archived notes reject ${operation} without persistence`, async () => {
    let writes = 0;
    const fail = async () => {
      writes++;
      throw new Error("Should not write");
    };
    const service = createNotesService(
      repository({
        findByIdForUser: async () => taskAggregate({ isArchived: true }),
        replaceForUser: fail,
        setTaskCompletionForUser: fail,
        setItemCompletionForUser: fail,
      }),
    );
    const result =
      operation === "replace"
        ? service.replace(
            noteId,
            {
              kind: "task",
              title: "Updated",
              content: null,
              dueDate: "2026-10-20",
              isCompleted: false,
              expectedVersion: 1,
            },
            userId,
          )
        : operation === "setTaskCompletion"
          ? service.setTaskCompletion(noteId, { isCompleted: true }, userId)
          : service.setItemCompletion(noteId, "item", { isCompleted: true }, userId);
    await assert.rejects(result, { code: "archived_note_read_only" });
    assert.equal(writes, 0);
  });

for (const status of ["not_found", "version_conflict"] as const)
  test(`note archive and deletion translate ${status}`, async () => {
    const service = createNotesService(
      repository({
        setArchivedForUser: async () => ({ status }),
        deleteForUser: async () => ({ status }),
      }),
    );
    const code = status === "not_found" ? "note_not_found" : "note_version_conflict";
    await assert.rejects(service.archive(noteId, { isArchived: true }, userId), { code });
    await assert.rejects(service.remove(noteId, 1, userId), { code });
  });

test("note get/list/reminders hide ownership fields and preserve pagination", async () => {
  const service = createNotesService(
    repository({
      listByUser: async (owner, filters) => {
        assert.equal(owner, userId);
        assert.equal(filters.offset, 2);
        return { aggregates: [taskAggregate()], total: 4 };
      },
    }),
  );
  const result = await service.list(userId, { status: "active", limit: 1, offset: 2 });
  assert.equal(result.hasMore, true);
  assert.equal(result.total, 4);
  assert.equal("userId" in result.items[0], false);
  assert.equal((await service.get(noteId, userId)).id, noteId);
  const reminders = await service.listTaskReminders(userId, "2026-09-12");
  assert.deepEqual(reminders[0], {
    id: noteId,
    title: "Entregar relatório",
    dueDate: "2026-09-11",
    updatedAt: now.toISOString(),
  });
});

test("note archive is idempotent and task completion cannot change a text note", async () => {
  let writes = 0;
  const service = createNotesService(
    repository({
      findByIdForUser: async () => taskAggregate({ kind: "text" }),
      setArchivedForUser: async () => {
        writes++;
        throw new Error("Unexpected");
      },
    }),
  );
  await service.archive(noteId, { isArchived: false }, userId);
  assert.equal(writes, 0);
  await assert.rejects(service.setTaskCompletion(noteId, { isCompleted: true }, userId), {
    code: "note_kind_mismatch",
  });
});

for (const status of ["updated", "version_conflict", "item_not_found", "note_not_found"] as const)
  test(`checklist completion handles ${status} with scoped item and version`, async () => {
    const aggregate = taskAggregate({ kind: "checklist" });
    aggregate.items = [
      {
        id: "item",
        userId,
        noteId,
        text: "Pending",
        isCompleted: false,
        position: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const service = createNotesService(
      repository({
        findByIdForUser: async () => aggregate,
        setItemCompletionForUser: async (...args) => {
          assert.deepEqual(args, [noteId, "item", userId, 1, true]);
          return status === "updated"
            ? {
                status,
                aggregate: { ...aggregate, items: [{ ...aggregate.items[0], isCompleted: true }] },
              }
            : { status };
        },
      }),
    );
    if (status === "updated")
      assert.equal(
        (await service.setItemCompletion(noteId, "item", { isCompleted: true }, userId)).items[0]
          .isCompleted,
        true,
      );
    else
      await assert.rejects(
        service.setItemCompletion(noteId, "item", { isCompleted: true }, userId),
        {
          code:
            status === "version_conflict"
              ? "note_version_conflict"
              : status === "item_not_found"
                ? "note_item_not_found"
                : "note_not_found",
        },
      );
  });

test("missing notes and failed reads never become empty successful results", async () => {
  const service = createNotesService(repository({ findByIdForUser: async () => null }));
  await assert.rejects(service.get(noteId, userId), { code: "note_not_found" });
  const error = new Error("Database unavailable");
  const failed = createNotesService(
    repository({
      listByUser: async () => {
        throw error;
      },
    }),
  );
  await assert.rejects(
    failed.list(userId, { status: "active", limit: 10, offset: 0 }),
    (actual) => actual === error,
  );
});

test("deleting a note cleans attachments left without any link", async () => {
  const cleanedUsers: string[] = [];
  const service = createNotesService(
    repository({ deleteForUser: async (id) => ({ status: "deleted", id }) }),
    { cleanupOrphans: async (owner) => cleanedUsers.push(owner) },
  );

  assert.deepEqual(await service.remove(noteId, 1, userId), { id: noteId });
  assert.deepEqual(cleanedUsers, [userId]);
});

test("note output exposes how many files are attached", async () => {
  const service = createNotesService(
    repository({ findByIdForUser: async () => ({ ...taskAggregate(), attachmentCount: 3 }) }),
  );

  assert.equal((await service.get(noteId, userId)).attachmentCount, 3);
});

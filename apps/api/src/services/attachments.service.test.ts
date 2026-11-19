import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { maximumAttachmentSize } from "@openmonetis/domain/attachments";
import type { AttachmentStorage } from "../utils/storage";
import { type AttachmentsRepository, createAttachmentsService } from "./attachments.service";

type Record = NonNullable<Awaited<ReturnType<AttachmentsRepository["findForUser"]>>>;

function fixture() {
  const owner = "owner";
  const records = new Map<string, Record>();
  const objects = new Map<string, Awaited<ReturnType<AttachmentStorage["inspect"]>>>();
  const links = new Set<string>();
  let failRemove = false;
  let failCommit = false;
  let failPrepare = false;
  let failFinalize = false;
  const owned = (id: string, userId: string) => {
    const row = records.get(id);
    return row?.userId === userId ? row : null;
  };
  const mark = (id: string, userId: string) => {
    const row = owned(id, userId);
    if (!row) return null;
    row.fileKey = `deleting/${row.fileKey}`;
    return row;
  };
  const notes = new Map([
    ["note-active", { isArchived: false }],
    ["note-archived", { isArchived: true }],
  ]);
  const detach = (linkKey: string, id: string, userId: string) => {
    const row = owned(id, userId);
    if (!row || !links.delete(linkKey)) return null;
    const orphaned = ![...links].some((link) => link.endsWith(`:${id}`));
    return { attachment: orphaned ? (mark(id, userId) as Record) : row, orphaned };
  };
  const repository: AttachmentsRepository = {
    transactionExistsForUser: async (id, userId) => userId === owner && id.startsWith("owned"),
    findNoteStateForUser: async (id, userId) => (userId === owner ? (notes.get(id) ?? null) : null),
    finalizeAndAttachToNote: async (id, noteId, userId, pending, final) => {
      const row = owned(id, userId);
      if (!row || ![pending, final].includes(row.fileKey)) return null;
      row.fileKey = final;
      links.add(`note:${noteId}:${id}`);
      return row;
    },
    listForNote: async (noteId, userId) =>
      [...records.values()].filter(
        (row) => row.userId === userId && links.has(`note:${noteId}:${row.id}`),
      ),
    detachFromNoteForUser: async (noteId, id, userId) => detach(`note:${noteId}:${id}`, id, userId),
    insertPending: async (input) => {
      const row = { ...input, createdAt: new Date() };
      records.set(row.id, row);
      return row;
    },
    findForUser: async (id, userId) => owned(id, userId),
    finalizeAndAttach: async (id, transactionId, userId, pending, final) => {
      if (failFinalize) throw new Error("database unavailable");
      const row = owned(id, userId);
      if (!row || ![pending, final].includes(row.fileKey)) return null;
      row.fileKey = final;
      links.add(`${transactionId}:${id}`);
      return row;
    },
    listForTransaction: async (id, userId) =>
      [...records.values()].filter((row) => row.userId === userId && links.has(`${id}:${row.id}`)),
    listLinksForPeriod: async () => [],
    markForDeletionForUser: async (id, userId) => mark(id, userId),
    markPendingForDeletionForUser: async (id, userId, key) =>
      owned(id, userId)?.fileKey === key ? mark(id, userId) : null,
    markOrphansForDeletionForUser: async (userId) =>
      [...records.values()]
        .filter(
          (row) =>
            row.userId === userId &&
            row.fileKey.startsWith("attachments/") &&
            ![...links].some((link) => link.endsWith(`:${row.id}`)),
        )
        .flatMap((row) => mark(row.id, userId) ?? []),
    markExpiredPendingForDeletionForUser: async (userId, before) =>
      [...records.values()]
        .filter(
          (row) =>
            row.userId === userId && row.fileKey.startsWith("pending/") && row.createdAt < before,
        )
        .flatMap((row) => mark(row.id, userId) ?? []),
    listDeletionTombstonesForUser: async (userId) =>
      [...records.values()].filter(
        (row) => row.userId === userId && row.fileKey.startsWith("deleting/"),
      ),
    deleteDeletionTombstoneForUser: async (id, userId, key) => {
      const row = owned(id, userId);
      if (row?.fileKey !== key) return null;
      records.delete(id);
      return row;
    },
    detachFromTransactionForUser: async (transactionId, id, userId) =>
      detach(`${transactionId}:${id}`, id, userId),
  };
  const storage: AttachmentStorage = {
    enabled: true,
    prepareUpload: async () => {
      if (failPrepare) throw new Error("signing unavailable");
      return { uploadUrl: "https://test.invalid/upload" };
    },
    inspect: async (key) => {
      const object = objects.get(key);
      if (!object) throw new Error("missing object");
      return object;
    },
    commit: async (from, to, etag) => {
      if (failCommit) throw new Error("copy unavailable");
      const object = objects.get(from);
      assert.equal(object?.etag, etag);
      objects.set(to, object as NonNullable<typeof object>);
    },
    remove: async (key) => {
      if (failRemove) throw new Error("storage unavailable");
      objects.delete(key);
    },
    signDownload: async (key) => {
      assert.ok(objects.has(key));
      return { url: "https://test.invalid/download", expiresAt: new Date().toISOString() };
    },
  };
  const service = createAttachmentsService(repository, storage);
  async function prepare() {
    const upload = await service.prepare(
      {
        transactionId: "owned-1",
        fileName: "receipt.pdf",
        fileSize: 8,
        mimeType: "application/pdf",
      },
      owner,
    );
    objects.set(`pending/${upload.uploadId}`, {
      size: 8,
      mimeType: "application/pdf",
      etag: "etag",
      bytes: new TextEncoder().encode("%PDF-1.4"),
    });
    return { uploadId: upload.uploadId, transactionId: "owned-1" };
  }
  async function prepareForNote(noteId = "note-active") {
    const upload = await service.prepareForNote(
      noteId,
      { fileName: "photo.png", fileSize: 8, mimeType: "image/png" },
      owner,
    );
    objects.set(`pending/${upload.uploadId}`, {
      size: 8,
      mimeType: "image/png",
      etag: "etag",
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    return { uploadId: upload.uploadId };
  }
  return {
    owner,
    records,
    objects,
    links,
    storage,
    service,
    prepare,
    prepareForNote,
    fail: (kind: "remove" | "commit" | "prepare" | "finalize", value = true) => {
      if (kind === "remove") failRemove = value;
      if (kind === "commit") failCommit = value;
      if (kind === "prepare") failPrepare = value;
      if (kind === "finalize") failFinalize = value;
    },
  };
}

test("attachment confirmation validates bytes, commits once and is safe to retry", async () => {
  const f = fixture();
  const input = await f.prepare();
  const output = await f.service.confirm(input, f.owner);
  assert.equal("fileKey" in output, false);
  assert.equal("userId" in output, false);
  assert.ok(f.objects.has(`attachments/${output.id}`));
  assert.equal(f.objects.has(`pending/${output.id}`), false);
  assert.deepEqual(await f.service.confirm(input, f.owner), output);
  assert.equal(f.links.size, 1);
  assert.equal((await f.service.listForTransaction("owned-1", f.owner)).length, 1);
});

test("attachment preparation enforces ownership, whitelist, storage availability and size before persistence", async () => {
  const f = fixture();
  const input = {
    transactionId: "owned-1",
    fileName: "receipt.pdf",
    fileSize: 8,
    mimeType: "application/pdf" as const,
  };
  await assert.rejects(f.service.prepare(input, "stranger"), { code: "transaction_not_found" });
  for (const fileSize of [0, maximumAttachmentSize + 1])
    await assert.rejects(f.service.prepare({ ...input, fileSize }, f.owner), {
      code: "invalid_attachment",
    });
  f.storage.enabled = false;
  await assert.rejects(f.service.prepare(input, f.owner), {
    code: "attachment_storage_unavailable",
  });
  assert.equal(f.records.size, 0);
});

for (const invalid of ["size", "mime", "etag", "signature", "missing"] as const)
  test(`confirmation rejects ${invalid} and removes pending content without linking it`, async () => {
    const f = fixture();
    const input = await f.prepare();
    const key = `pending/${input.uploadId}`;
    const object = f.objects.get(key);
    assert.ok(object);
    if (invalid === "size") object.size = 9;
    if (invalid === "mime") object.mimeType = "image/png";
    if (invalid === "etag") object.etag = null;
    if (invalid === "signature") object.bytes = new TextEncoder().encode("<script>");
    if (invalid === "missing") f.objects.delete(key);
    await assert.rejects(f.service.confirm(input, f.owner));
    assert.equal(f.records.size, 0);
    assert.equal(f.objects.size, 0);
    assert.equal(f.links.size, 0);
  });

test("foreign uploads cannot be confirmed, downloaded, detached or removed", async () => {
  const f = fixture();
  const input = await f.prepare();
  await assert.rejects(f.service.confirm(input, "stranger"), { code: "transaction_not_found" });
  await assert.rejects(f.service.getDownloadUrl(input.uploadId, "stranger", "inline"), {
    code: "attachment_not_found",
  });
  await assert.rejects(f.service.detach("owned-1", input.uploadId, "stranger"), {
    code: "attachment_not_found",
  });
  await assert.rejects(f.service.remove(input.uploadId, "stranger"), {
    code: "attachment_not_found",
  });
  assert.equal(f.records.size, 1);
  assert.equal(f.objects.size, 1);
});

test("failed signing removes the pending record and a failed commit remains retryable", async () => {
  const f = fixture();
  f.fail("prepare");
  await assert.rejects(f.prepare(), /signing unavailable/);
  assert.equal(f.records.size, 0);
  f.fail("prepare", false);
  const input = await f.prepare();
  f.fail("commit");
  await assert.rejects(f.service.confirm(input, f.owner), /copy unavailable/);
  assert.equal(f.links.size, 0);
  assert.equal(f.records.get(input.uploadId)?.fileKey, `pending/${input.uploadId}`);
  f.fail("commit", false);
  await f.service.confirm(input, f.owner);
});

test("failed database finalization removes copied content and preserves the original error", async () => {
  const f = fixture();
  const input = await f.prepare();
  f.fail("finalize");
  await assert.rejects(f.service.confirm(input, f.owner), /database unavailable/);
  assert.equal(f.objects.has(`attachments/${input.uploadId}`), false);
  assert.equal(f.links.size, 0);
});

test("shared attachments survive one detach and are deleted after the last link", async () => {
  const f = fixture();
  const input = await f.prepare();
  await f.service.confirm(input, f.owner);
  await f.service.confirm({ ...input, transactionId: "owned-2" }, f.owner);
  assert.equal((await f.service.detach("owned-1", input.uploadId, f.owner)).deleted, false);
  assert.equal(f.objects.size, 1);
  assert.equal((await f.service.detach("owned-2", input.uploadId, f.owner)).deleted, true);
  assert.equal(f.records.size, 0);
  assert.equal(f.objects.size, 0);
});

test("failed object deletion keeps a tombstone for the next cleanup attempt", async (t) => {
  t.mock.method(console, "error", () => {});
  const f = fixture();
  const input = await f.prepare();
  await f.service.confirm(input, f.owner);
  f.fail("remove");
  await f.service.remove(input.uploadId, f.owner);
  assert.equal(f.records.get(input.uploadId)?.fileKey, `deleting/attachments/${input.uploadId}`);
  assert.equal(f.objects.size, 1);
  f.fail("remove", false);
  assert.equal((await f.service.cleanupOrphans(f.owner)).deletedCount, 1);
  assert.equal(f.records.size, 0);
  assert.equal(f.objects.size, 0);
});

test("cleanup expires only old owned pending uploads and preserves fresh or foreign uploads", async () => {
  const f = fixture();
  const old = await f.prepare();
  const fresh = await f.prepare();
  const row = f.records.get(old.uploadId);
  assert.ok(row);
  row.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const foreignId = randomUUID();
  f.records.set(foreignId, {
    ...row,
    id: foreignId,
    userId: "stranger",
    fileKey: `pending/${foreignId}`,
  });
  assert.equal((await f.service.cleanupOrphans(f.owner)).deletedCount, 1);
  assert.ok(f.records.has(fresh.uploadId));
  assert.ok(f.records.has(foreignId));
  assert.equal(f.records.has(old.uploadId), false);
});

test("note attachments upload, list and delete the file after the last note link", async () => {
  const { owner, objects, records, service, prepareForNote } = fixture();
  const { uploadId } = await prepareForNote();

  const attachment = await service.confirmForNote("note-active", { uploadId }, owner);
  assert.equal(attachment.mimeType, "image/png");
  assert.deepEqual(
    (await service.listForNote("note-active", owner)).map((item) => item.id),
    [uploadId],
  );
  assert.ok(objects.has(`attachments/${uploadId}`));

  const detached = await service.detachFromNote("note-active", uploadId, owner);
  assert.deepEqual(detached, { id: uploadId, noteId: "note-active", deleted: true });
  assert.equal(records.has(uploadId), false);
  assert.equal(objects.has(`attachments/${uploadId}`), false);
});

test("note attachments enforce ownership and keep archived notes read-only", async () => {
  const { owner, service, prepareForNote } = fixture();
  const file = { fileName: "photo.png", fileSize: 8, mimeType: "image/png" as const };

  await assert.rejects(service.prepareForNote("note-archived", file, owner), {
    code: "archived_note_read_only",
  });
  await assert.rejects(service.prepareForNote("note-active", file, "intruder"), {
    code: "note_not_found",
  });
  await assert.rejects(service.listForNote("note-active", "intruder"), {
    code: "note_not_found",
  });

  const { uploadId } = await prepareForNote();
  await assert.rejects(service.confirmForNote("note-archived", { uploadId }, owner), {
    code: "archived_note_read_only",
  });
  await service.confirmForNote("note-active", { uploadId }, owner);
  await assert.rejects(service.detachFromNote("note-active", uploadId, "intruder"), {
    code: "note_not_found",
  });
  assert.equal((await service.listForNote("note-archived", owner)).length, 0);
});

test("a file shared by a transaction and a note survives detaching from the note", async () => {
  const { owner, objects, service, prepare, links } = fixture();
  const upload = await prepare();
  await service.confirm(upload, owner);
  links.add(`note:note-active:${upload.uploadId}`);

  const detached = await service.detachFromNote("note-active", upload.uploadId, owner);
  assert.equal(detached.deleted, false);
  assert.ok(objects.has(`attachments/${upload.uploadId}`));
});

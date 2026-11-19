import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { AttachmentOutput } from "@openmonetis/validators/attachments";
import { createTestApiClient } from "./test-support/api-client";
import { withIntegrationDatabase } from "./test-support/integration-database";

test("S3 uploads validate real objects and preserve database ownership and deletion semantics", {
  skip: process.env.STORAGE_INTEGRATION_TEST !== "1",
}, async (t) => {
  const endpoint = process.env.TEST_S3_ENDPOINT ?? "http://127.0.0.1:19000";
  const bucket = `openmonetis-test-${randomUUID()}`;
  const credentials = { accessKeyId: "test-access-key", secretAccessKey: "test-secret-key" };
  const s3 = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  try {
    await withIntegrationDatabase(
      async () => {
        const api = await createTestApiClient();
        const owner = await api.register();
        const stranger = await api.register();
        const first = await api.expense(owner);
        const second = await api.expense(owner);
        const { db, attachments } = await import("@openmonetis/db");
        const { eq } = await import("drizzle-orm");
        const bytes = new TextEncoder().encode("%PDF-1.4\nfixture");
        async function upload(content: Uint8Array = bytes, declaredSize = content.length) {
          const prepared = await api.data<{ uploadId: string; uploadUrl: string }>(
            await api.request("/attachments/prepare", owner, "POST", {
              transactionId: first.recordId,
              fileName: "receipt.pdf",
              fileSize: declaredSize,
              mimeType: "application/pdf",
            }),
          );
          const url = new URL(prepared.uploadUrl);
          assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
          const put = await fetch(prepared.uploadUrl, {
            method: "PUT",
            headers: { "content-type": "application/pdf" },
            body: Buffer.from(content),
          });
          assert.ok(put.ok, await put.text());
          return prepared;
        }
        await t.test(
          "presigned upload, content inspection, copy, signed download and idempotent confirmation work over S3 HTTP",
          async () => {
            const prepared = await upload();
            const body = { uploadId: prepared.uploadId, transactionId: first.recordId };
            const confirmed = await api.data<AttachmentOutput>(
              await api.request("/attachments/confirm", owner, "POST", body),
              201,
            );
            assert.deepEqual(
              await api.data(await api.request("/attachments/confirm", owner, "POST", body), 201),
              confirmed,
            );
            const signed = await api.data<{ url: string }>(
              await api.request(
                `/attachments/${confirmed.id}/download-url?disposition=attachment`,
                owner,
              ),
            );
            const downloaded = await fetch(signed.url);
            assert.ok(downloaded.ok);
            assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), Buffer.from(bytes));
            assert.match(downloaded.headers.get("content-disposition") ?? "", /^attachment;/);
            await api.error(
              await api.request(`/attachments/${confirmed.id}/download-url`, stranger),
              404,
            );
            await api.error(
              await api.request(`/attachments/${confirmed.id}`, stranger, "DELETE"),
              404,
            );
            await api.data(
              await api.request("/attachments/confirm", owner, "POST", {
                ...body,
                transactionId: second.recordId,
              }),
              201,
            );
            await api.data(
              await api.request(
                `/attachments/transaction/${first.recordId}/${confirmed.id}`,
                owner,
                "DELETE",
              ),
            );
            assert.equal(
              (await db.select().from(attachments).where(eq(attachments.id, confirmed.id))).length,
              1,
            );
            await api.data(
              await api.request(
                `/attachments/transaction/${second.recordId}/${confirmed.id}`,
                owner,
                "DELETE",
              ),
            );
            assert.deepEqual(
              await db.select().from(attachments).where(eq(attachments.id, confirmed.id)),
              [],
            );
          },
        );
        await t.test(
          "forged PDF content and mismatched size are rejected and removed from S3",
          async () => {
            for (const prepared of [
              await upload(new TextEncoder().encode("<script>bad</script>")),
              await upload(bytes, bytes.length + 1),
            ]) {
              await api.error(
                await api.request("/attachments/confirm", owner, "POST", {
                  uploadId: prepared.uploadId,
                  transactionId: first.recordId,
                }),
                400,
              );
              assert.deepEqual(
                await db.select().from(attachments).where(eq(attachments.id, prepared.uploadId)),
                [],
              );
              const objects = await s3.send(
                new ListObjectsV2Command({
                  Bucket: bucket,
                  Prefix: `pending/${prepared.uploadId}`,
                }),
              );
              assert.equal(objects.KeyCount, 0);
            }
          },
        );
        await t.test(
          "note attachments upload over S3, stay read-only when archived and are cleaned with their last link",
          async () => {
            const pngBytes = Uint8Array.from([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
            ]);
            async function createNote(kind: "text" | "checklist" | "task") {
              const body =
                kind === "text"
                  ? { title: "Contrato", kind, content: "Revisar cláusulas" }
                  : kind === "checklist"
                    ? { title: "Documentos", kind, items: [{ text: "RG" }] }
                    : { title: "Pagar IPVA", kind, dueDate: "2026-12-10" };
              return api.data<{ id: string; version: number; attachmentCount: number }>(
                await api.request("/notes", owner, "POST", body),
                201,
              );
            }
            async function uploadToNote(noteId: string) {
              const prepared = await api.data<{ uploadId: string; uploadUrl: string }>(
                await api.request(`/attachments/note/${noteId}/prepare`, owner, "POST", {
                  fileName: "foto.png",
                  fileSize: pngBytes.length,
                  mimeType: "image/png",
                }),
              );
              const put = await fetch(prepared.uploadUrl, {
                method: "PUT",
                headers: { "content-type": "image/png" },
                body: Buffer.from(pngBytes),
              });
              assert.ok(put.ok, await put.text());
              return api.data<AttachmentOutput>(
                await api.request(`/attachments/note/${noteId}/confirm`, owner, "POST", {
                  uploadId: prepared.uploadId,
                }),
                201,
              );
            }
            async function objectCount(id: string) {
              const objects = await s3.send(
                new ListObjectsV2Command({ Bucket: bucket, Prefix: `attachments/${id}` }),
              );
              return objects.KeyCount ?? 0;
            }

            for (const kind of ["text", "checklist", "task"] as const) {
              const note = await createNote(kind);
              const attachment = await uploadToNote(note.id);
              const listed = await api.data<AttachmentOutput[]>(
                await api.request(`/attachments/note/${note.id}`, owner),
              );
              assert.deepEqual(
                listed.map((item) => item.id),
                [attachment.id],
              );
              const detail = await api.data<{ attachmentCount: number }>(
                await api.request(`/notes/${note.id}`, owner),
              );
              assert.equal(detail.attachmentCount, 1);
              await api.error(await api.request(`/attachments/note/${note.id}`, stranger), 404);
              await api.error(
                await api.request(
                  `/attachments/note/${note.id}/${attachment.id}`,
                  stranger,
                  "DELETE",
                ),
                404,
              );
              await api.data(
                await api.request(`/attachments/note/${note.id}/${attachment.id}`, owner, "DELETE"),
              );
              assert.equal(await objectCount(attachment.id), 0);
            }

            const archived = await createNote("text");
            const kept = await uploadToNote(archived.id);
            await api.data(
              await api.request(`/notes/${archived.id}/archive`, owner, "PATCH", {
                isArchived: true,
              }),
            );
            await api.error(
              await api.request(`/attachments/note/${archived.id}/prepare`, owner, "POST", {
                fileName: "foto.png",
                fileSize: pngBytes.length,
                mimeType: "image/png",
              }),
              400,
              "archived_note_read_only",
            );
            await api.error(
              await api.request(`/attachments/note/${archived.id}/${kept.id}`, owner, "DELETE"),
              400,
              "archived_note_read_only",
            );

            const shared = await createNote("text");
            const sharedFile = await uploadToNote(shared.id);
            await api.data(
              await api.request("/attachments/confirm", owner, "POST", {
                uploadId: sharedFile.id,
                transactionId: first.recordId,
              }),
              201,
            );
            const sharedNote = await api.data<{ version: number }>(
              await api.request(`/notes/${shared.id}`, owner),
            );
            await api.data(
              await api.request(
                `/notes/${shared.id}?expectedVersion=${sharedNote.version}`,
                owner,
                "DELETE",
              ),
            );
            assert.equal(await objectCount(sharedFile.id), 1);
            await api.data(
              await api.request(
                `/attachments/transaction/${first.recordId}/${sharedFile.id}`,
                owner,
                "DELETE",
              ),
            );
            assert.equal(await objectCount(sharedFile.id), 0);

            const removable = await createNote("task");
            const orphan = await uploadToNote(removable.id);
            await api.data(
              await api.request(
                `/notes/${removable.id}?expectedVersion=${removable.version}`,
                owner,
                "DELETE",
              ),
            );
            assert.equal(await objectCount(orphan.id), 0);
            assert.deepEqual(
              await db.select().from(attachments).where(eq(attachments.id, orphan.id)),
              [],
            );
          },
        );
      },
      {
        environment: {
          S3_BUCKET: bucket,
          S3_ENDPOINT: endpoint,
          S3_REGION: "us-east-1",
          S3_ACCESS_KEY_ID: credentials.accessKeyId,
          S3_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        },
      },
    );
  } finally {
    try {
      const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
      if (objects.Contents?.length)
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects.Contents.map(({ Key }) => ({ Key })) },
          }),
        );
      await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
    } finally {
      s3.destroy();
    }
  }
});

import type {
  AttachmentOutput,
  AttachmentUrlOutput,
  ConfirmAttachmentInput,
  ConfirmNoteAttachmentInput,
  ListAttachmentsQuery,
  PaginatedAttachmentsOutput,
  PrepareAttachmentInput,
  PrepareNoteAttachmentInput,
} from "@openmonetis/validators/attachments";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

export function getAttachments(query: ListAttachmentsQuery) {
  const params = new URLSearchParams({
    period: query.period,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.q) params.set("q", query.q);
  if (query.kind) params.set("kind", query.kind);
  if (query.personId) params.set("personId", query.personId);

  return request<PaginatedAttachmentsOutput>(`/attachments?${params.toString()}`);
}

export const getTransactionAttachments = (transactionId: string) =>
  request<AttachmentOutput[]>(`/attachments/transaction/${encodeURIComponent(transactionId)}`);

export const getNoteAttachments = (noteId: string) =>
  request<AttachmentOutput[]>(`/attachments/note/${encodeURIComponent(noteId)}`);

export const getAttachmentUrl = (id: string, disposition: "inline" | "attachment" = "inline") =>
  request<AttachmentUrlOutput>(
    `/attachments/${encodeURIComponent(id)}/download-url?disposition=${disposition}`,
  );

const prepareAttachment = (input: PrepareAttachmentInput) =>
  request<{ uploadId: string; uploadUrl: string }>("/attachments/prepare", {
    method: "POST",
    body: JSON.stringify(input),
  });

const confirmAttachment = (input: ConfirmAttachmentInput) =>
  request<AttachmentOutput>("/attachments/confirm", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteAttachment = (id: string) =>
  request<{ id: string }>(`/attachments/${encodeURIComponent(id)}`, { method: "DELETE" });

export const detachTransactionAttachment = (transactionId: string, attachmentId: string) =>
  request<{ id: string; transactionId: string; deleted: boolean }>(
    `/attachments/transaction/${encodeURIComponent(transactionId)}/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );

export const detachNoteAttachment = (noteId: string, attachmentId: string) =>
  request<{ id: string; noteId: string; deleted: boolean }>(
    `/attachments/note/${encodeURIComponent(noteId)}/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );

const prepareNoteAttachment = (noteId: string, input: PrepareNoteAttachmentInput) =>
  request<{ uploadId: string; uploadUrl: string }>(
    `/attachments/note/${encodeURIComponent(noteId)}/prepare`,
    { method: "POST", body: JSON.stringify(input) },
  );

const confirmNoteAttachment = (noteId: string, input: ConfirmNoteAttachmentInput) =>
  request<AttachmentOutput>(`/attachments/note/${encodeURIComponent(noteId)}/confirm`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export async function uploadAttachment(file: File, transactionId: string) {
  const prepared = await prepareAttachment({ transactionId, ...describeFile(file) });
  await putFile(prepared.uploadUrl, file);
  return confirmAttachment({ uploadId: prepared.uploadId, transactionId });
}

export async function uploadNoteAttachment(file: File, noteId: string) {
  const prepared = await prepareNoteAttachment(noteId, describeFile(file));
  await putFile(prepared.uploadUrl, file);
  return confirmNoteAttachment(noteId, { uploadId: prepared.uploadId });
}

function describeFile(file: File): PrepareNoteAttachmentInput {
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type as PrepareNoteAttachmentInput["mimeType"],
  };
}

async function putFile(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) throw new Error("Upload failed");
}

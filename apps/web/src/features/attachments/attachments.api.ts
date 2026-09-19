import type {
  AttachmentOutput,
  AttachmentUrlOutput,
  ConfirmAttachmentInput,
  ListAttachmentsQuery,
  PaginatedAttachmentsOutput,
  PrepareAttachmentInput,
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

export async function uploadAttachment(file: File, transactionId: string) {
  const input = {
    transactionId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type as PrepareAttachmentInput["mimeType"],
  };
  const prepared = await prepareAttachment(input);
  const response = await fetch(prepared.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) throw new Error("Upload failed");

  return confirmAttachment({ uploadId: prepared.uploadId, transactionId });
}

import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
} from "@openmonetis/shared/date-time";
import {
  attachmentMimeTypes,
  ListAttachmentsQuerySchema,
  maximumAttachmentSize,
  PrepareAttachmentInputSchema,
} from "@openmonetis/validators/attachments";
import type { ClipboardEvent as ReactClipboardEvent } from "react";

export type AttachmentsSearch = {
  period?: string;
  q?: string;
  kind?: "image" | "pdf";
  personId?: string;
  page?: number;
};

export const attachmentAccept = attachmentMimeTypes.join(",");
export const maximumAttachmentSizeMb = maximumAttachmentSize / 1024 / 1024;

export function validateAttachmentsSearch(search: Record<string, unknown>): AttachmentsSearch {
  const period = ListAttachmentsQuerySchema.shape.period.safeParse(search.period);
  const q = ListAttachmentsQuerySchema.shape.q.safeParse(search.q);
  const kind = ListAttachmentsQuerySchema.shape.kind.safeParse(search.kind);
  const personId = ListAttachmentsQuerySchema.shape.personId.safeParse(search.personId);
  const page = ListAttachmentsQuerySchema.shape.page.safeParse(search.page);

  return {
    period: period.success ? period.data : undefined,
    q: q.success ? q.data : undefined,
    kind: kind.success ? kind.data : undefined,
    personId: personId.success ? personId.data : undefined,
    page: page.success && page.data > 1 ? page.data : undefined,
  };
}

export function getCurrentAttachmentPeriod() {
  return getCurrentPeriodInBrazil();
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatAttachmentDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {});
}

export function attachmentTypeLabel(mimeType: string) {
  return mimeType === "application/pdf" ? "PDF" : "Imagem";
}

export function validateAttachmentFile(file: File) {
  if (!PrepareAttachmentInputSchema.shape.mimeType.safeParse(file.type).success) {
    return "Tipo de arquivo não suportado. Use PDF ou imagem (JPEG, PNG, WebP).";
  }

  if (!PrepareAttachmentInputSchema.shape.fileSize.safeParse(file.size).success) {
    if (file.size <= 0) return "O arquivo está vazio.";
    return `O arquivo deve ter no máximo ${maximumAttachmentSizeMb} MB.`;
  }
  if (!PrepareAttachmentInputSchema.shape.fileName.safeParse(file.name).success) {
    return "Use um nome de arquivo mais curto.";
  }
}

export function getFilesFromClipboard(event: ClipboardEvent | ReactClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? []);

  if (files.length) return files;

  return Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

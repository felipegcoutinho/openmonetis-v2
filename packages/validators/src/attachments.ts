import { z } from "@hono/zod-openapi";
import {
  attachmentKinds,
  attachmentMimeTypes,
  maximumAttachmentSize,
} from "@openmonetis/domain/attachments";
import { transactionTypes } from "@openmonetis/domain/transactions";

export {
  attachmentKinds,
  attachmentMimeTypes,
  maximumAttachmentSize,
} from "@openmonetis/domain/attachments";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

export const PrepareAttachmentInputSchema = z
  .object({
    transactionId: z.uuid(),
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive().max(maximumAttachmentSize),
    mimeType: z.enum(attachmentMimeTypes),
  })
  .openapi("PrepareAttachmentInput");

export const ConfirmAttachmentInputSchema = z
  .object({
    uploadId: z.uuid(),
    transactionId: z.uuid(),
  })
  .openapi("ConfirmAttachmentInput");

export const ListAttachmentsQuerySchema = z
  .object({
    period: periodSchema.openapi({
      param: { name: "period", in: "query" },
      example: "2026-07",
    }),
    q: z.string().trim().min(1).max(160).optional(),
    kind: z.enum(attachmentKinds).optional(),
    personId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => [20, 40, 80].includes(value))
      .default(20),
  })
  .openapi("ListAttachmentsQuery");

export const AttachmentParamsSchema = z
  .object({
    id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
  })
  .openapi("AttachmentParams");

export const TransactionAttachmentParamsSchema = z
  .object({
    transactionId: z.uuid().openapi({ param: { name: "transactionId", in: "path" } }),
  })
  .openapi("TransactionAttachmentParams");

export const TransactionAttachmentItemParamsSchema = TransactionAttachmentParamsSchema.extend({
  attachmentId: z.uuid().openapi({ param: { name: "attachmentId", in: "path" } }),
}).openapi("TransactionAttachmentItemParams");

export const AttachmentUrlQuerySchema = z
  .object({
    disposition: z.enum(["inline", "attachment"]).default("inline"),
  })
  .openapi("AttachmentUrlQuery");

export const AttachmentOutputSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string(),
    fileSize: z.number().int().positive(),
    mimeType: z.enum(attachmentMimeTypes),
    createdAt: z.iso.datetime(),
  })
  .openapi("Attachment");

export const AttachmentListItemOutputSchema = AttachmentOutputSchema.extend({
  linkedTransactionCount: z.number().int().positive(),
  transactionId: z.uuid(),
  transactionName: z.string(),
  transactionAmount: z.number().finite(),
  transactionType: z.enum(transactionTypes),
  purchaseDate: z.iso.date(),
  transactionPeriod: periodSchema,
  personId: z.uuid(),
  personName: z.string(),
  personAvatarUrl: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryIcon: z.string().nullable(),
}).openapi("AttachmentListItem");

const AttachmentPersonFacetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  count: z.number().int().nonnegative(),
});

export const PaginatedAttachmentsOutputSchema = z
  .object({
    items: z.array(AttachmentListItemOutputSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    counts: z.object({
      all: z.number().int().nonnegative(),
      images: z.number().int().nonnegative(),
      pdfs: z.number().int().nonnegative(),
    }),
    people: z.array(AttachmentPersonFacetSchema),
  })
  .openapi("PaginatedAttachments");

export const PreparedAttachmentOutputSchema = z
  .object({ uploadId: z.uuid(), uploadUrl: z.url() })
  .openapi("PreparedAttachment");

export const AttachmentUrlOutputSchema = z
  .object({
    url: z.url(),
    expiresAt: z.iso.datetime(),
  })
  .openapi("AttachmentUrl");

export type PrepareAttachmentInput = z.infer<typeof PrepareAttachmentInputSchema>;
export type ConfirmAttachmentInput = z.infer<typeof ConfirmAttachmentInputSchema>;
export type ListAttachmentsQuery = z.infer<typeof ListAttachmentsQuerySchema>;
export type AttachmentOutput = z.infer<typeof AttachmentOutputSchema>;
export type AttachmentListItemOutput = z.infer<typeof AttachmentListItemOutputSchema>;
export type PaginatedAttachmentsOutput = z.infer<typeof PaginatedAttachmentsOutputSchema>;
export type AttachmentUrlOutput = z.infer<typeof AttachmentUrlOutputSchema>;

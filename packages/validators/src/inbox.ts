import { z } from "@hono/zod-openapi";
import {
  inboxBatchMaximumSize,
  inboxClearableStatuses,
  inboxClientIdMaximumLength,
  inboxItemStatuses,
  inboxOriginalTextMaximumLength,
  inboxOriginalTitleMaximumLength,
  inboxParsedNameMaximumLength,
  inboxSourceAppMaximumLength,
  inboxSourceAppNameMaximumLength,
} from "@openmonetis/domain/inbox";

const optionalTrimmedString = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength).nullish();

export const CompanionInboxItemInputSchema = z
  .object({
    sourceApp: z
      .string()
      .trim()
      .min(1)
      .max(inboxSourceAppMaximumLength)
      .regex(/^[A-Za-z0-9._-]+$/),
    sourceAppName: optionalTrimmedString(inboxSourceAppNameMaximumLength),
    originalTitle: optionalTrimmedString(inboxOriginalTitleMaximumLength),
    originalText: z.string().trim().min(1).max(inboxOriginalTextMaximumLength),
    notificationTimestamp: z.iso.datetime({ offset: true }),
    timestampFormatVersion: z.literal(2).optional(),
    parsedName: optionalTrimmedString(inboxParsedNameMaximumLength),
    parsedAmount: z.number().positive().max(999_999_999.99).nullish(),
    clientId: optionalTrimmedString(inboxClientIdMaximumLength),
  })
  .strict()
  .openapi("CompanionInboxItemInput");

export const CompanionInboxBatchInputSchema = z
  .object({ items: z.array(CompanionInboxItemInputSchema).min(1).max(inboxBatchMaximumSize) })
  .strict()
  .openapi("CompanionInboxBatchInput");

export const CompanionInboxAcceptedOutputSchema = z
  .object({
    id: z.uuid(),
    clientId: z.string().nullable(),
    message: z.string(),
  })
  .openapi("CompanionInboxAccepted");

export const CompanionInboxBatchResultSchema = z
  .object({
    clientId: z.string().nullable(),
    serverId: z.uuid().nullable(),
    success: z.boolean(),
    error: z.string().nullable(),
  })
  .openapi("CompanionInboxBatchResult");

export const CompanionInboxBatchOutputSchema = z
  .object({
    message: z.string(),
    total: z.number().int(),
    success: z.number().int(),
    failed: z.number().int(),
    results: z.array(CompanionInboxBatchResultSchema),
  })
  .openapi("CompanionInboxBatch");

export const CompanionInboxErrorSchema = z
  .object({ error: z.string() })
  .openapi("CompanionInboxError");

export const ListInboxItemsQuerySchema = z
  .object({
    status: z.enum(inboxItemStatuses).default("pending"),
    sourceAppName: z.string().trim().min(1).max(inboxSourceAppNameMaximumLength).optional(),
    notificationDate: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .openapi("ListInboxItemsQuery");

export const InboxSnapshotQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(6).default(4) })
  .openapi("InboxSnapshotQuery");

export const InboxItemParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("InboxItemParams");

export const ClearInboxItemsQuerySchema = z
  .object({ status: z.enum(inboxClearableStatuses) })
  .openapi("ClearInboxItemsQuery");

export const ClearInboxItemsOutputSchema = z
  .object({
    status: z.enum(inboxClearableStatuses),
    deletedCount: z.number().int().nonnegative(),
  })
  .openapi("ClearInboxItemsOutput");

export const ProcessInboxItemInputSchema = z
  .object({ transactionId: z.uuid() })
  .strict()
  .openapi("ProcessInboxItemInput");

export const InboxItemSummaryOutputSchema = z
  .object({
    id: z.uuid(),
    sourceAppName: z.string().nullable(),
    originalText: z.string(),
    notificationTimestamp: z.iso.datetime(),
    parsedName: z.string().nullable(),
    parsedAmount: z.number().nullable(),
    status: z.enum(inboxItemStatuses),
    transactionId: z.uuid().nullable(),
    processedAt: z.iso.datetime().nullable(),
    discardedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("InboxItemSummary");

export const InboxItemOutputSchema = InboxItemSummaryOutputSchema.extend({
  sourceApp: z.string(),
  originalTitle: z.string().nullable(),
}).openapi("InboxItem");

export const InboxStatusCountsOutputSchema = z
  .object({
    pending: z.number().int().nonnegative(),
    processed: z.number().int().nonnegative(),
    discarded: z.number().int().nonnegative(),
  })
  .openapi("InboxStatusCounts");

export const InboxPendingSummaryOutputSchema = z
  .object({
    totalAmount: z.number().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    sources: z.array(
      z.object({
        id: z.uuid(),
        kind: z.enum(["account", "card"]),
        name: z.string(),
        logo: z.string().nullable(),
        amount: z.number().nonnegative(),
        count: z.number().int().nonnegative(),
      }),
    ),
    unidentifiedAmount: z.number().nonnegative(),
    unidentifiedCount: z.number().int().nonnegative(),
  })
  .openapi("InboxPendingSummary");

export const InboxPageOutputSchema = z
  .object({
    items: z.array(InboxItemSummaryOutputSchema),
    sourceApps: z.array(z.string()),
    notificationDates: z.array(z.iso.date()),
    counts: InboxStatusCountsOutputSchema,
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
    pendingSummary: InboxPendingSummaryOutputSchema,
  })
  .openapi("InboxPage");

export const InboxSnapshotOutputSchema = z
  .object({
    pendingCount: z.number().int().nonnegative(),
    recentItems: z.array(
      InboxItemSummaryOutputSchema.pick({
        id: true,
        sourceAppName: true,
        parsedName: true,
        parsedAmount: true,
        notificationTimestamp: true,
      }),
    ),
  })
  .openapi("InboxSnapshot");

export type CompanionInboxItemInput = z.infer<typeof CompanionInboxItemInputSchema>;
export type ClearInboxItemsOutput = z.infer<typeof ClearInboxItemsOutputSchema>;
export type ListInboxItemsQuery = z.infer<typeof ListInboxItemsQuerySchema>;
export type InboxItemOutput = z.infer<typeof InboxItemOutputSchema>;
export type InboxItemSummaryOutput = z.infer<typeof InboxItemSummaryOutputSchema>;
export type InboxPageOutput = z.infer<typeof InboxPageOutputSchema>;
export type InboxSnapshotOutput = z.infer<typeof InboxSnapshotOutputSchema>;

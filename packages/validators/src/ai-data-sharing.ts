import { z } from "@hono/zod-openapi";
import { aiDataRetentionDaysOptions, aiDataScopes } from "@openmonetis/domain/ai-data-sharing";

export const AiDataScopeSchema = z.enum(aiDataScopes);

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

/** One of the offered retention periods, in days, or `null` to keep everything. */
export const AiDataRetentionDaysSchema = z
  .union(aiDataRetentionDaysOptions.map((days) => z.literal(days)))
  .nullable();

export const UpdateAiDataSharingInputSchema = z
  .object({ scopes: z.array(AiDataScopeSchema).max(aiDataScopes.length) })
  .strict()
  .openapi("UpdateAiDataSharingInput");

export const AiDataSharingOutputSchema = z
  .object({
    scopes: z.array(AiDataScopeSchema),
    isFull: z.boolean(),
    retentionDays: AiDataRetentionDaysSchema,
    updatedAt: z.iso.datetime().nullable(),
  })
  .openapi("AiDataSharing");

export const UpdateAiDataRetentionInputSchema = z
  .object({ retentionDays: AiDataRetentionDaysSchema })
  .strict()
  .openapi("UpdateAiDataRetentionInput");

export const AiDataHistoryDeletedOutputSchema = z
  .object({ chats: z.number().int().nonnegative(), diagnoses: z.number().int().nonnegative() })
  .openapi("AiDataHistoryDeleted");

export type UpdateAiDataSharingInput = z.infer<typeof UpdateAiDataSharingInputSchema>;
export type AiDataSharingOutput = z.infer<typeof AiDataSharingOutputSchema>;
export const AiDataPreviewQuerySchema = z
  .object({ period: periodSchema })
  .strict()
  .openapi("AiDataPreviewQuery");

/** Exactly the financial data object a diagnosis or chat of `period` would send today. */
export const AiDataPreviewOutputSchema = z
  .object({
    period: periodSchema,
    scopes: z.array(AiDataScopeSchema),
    data: z.record(z.string(), z.unknown()),
  })
  .openapi("AiDataPreview");

export type UpdateAiDataRetentionInput = z.infer<typeof UpdateAiDataRetentionInputSchema>;
export type AiDataHistoryDeletedOutput = z.infer<typeof AiDataHistoryDeletedOutputSchema>;
export type AiDataPreviewQuery = z.infer<typeof AiDataPreviewQuerySchema>;
export type AiDataPreviewOutput = z.infer<typeof AiDataPreviewOutputSchema>;

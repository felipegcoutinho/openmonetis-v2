import { z } from "@hono/zod-openapi";
import {
  maximumTransactionTags,
  normalizeTagName,
  tagColors,
  tagStatuses,
} from "@openmonetis/domain/tags";

export const TagIdsSchema = z
  .array(z.uuid())
  .max(maximumTransactionTags)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate tags are not allowed");
export const TagColorSchema = z.enum(tagColors);
export const CreateTagInputSchema = z
  .object({
    name: z.string().transform(normalizeTagName).pipe(z.string().min(1).max(80)),
    color: TagColorSchema.default("neutral"),
  })
  .strict()
  .openapi("CreateTagInput");
export const TagStatusSchema = z.enum(tagStatuses);
export const UpdateTagInputSchema = z
  .object({
    name: CreateTagInputSchema.shape.name.optional(),
    color: TagColorSchema.optional(),
    status: TagStatusSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdateTagInput");
export const TagParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});
export const TagOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    status: TagStatusSchema,
    color: TagColorSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("TagOutput");
export const TagsReportQuerySchema = z.object({
  period: z
    .string()
    .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
    .openapi({ param: { name: "period", in: "query" } }),
});
export const TagsReportOutputSchema = z
  .object({
    period: z.string(),
    items: z.array(
      z.object({
        tagId: z.uuid(),
        income: z.number(),
        expenses: z.number(),
        transfers: z.number().nonnegative().openapi({
          description:
            "Total transferred between accounts, counting each outgoing posting once without affecting balance",
        }),
        balance: z.number(),
        transactionCount: z.number().int().nonnegative().openapi({
          description: "Transactions with this tag in the period, counting each transfer once",
        }),
      }),
    ),
  })
  .openapi("TagsReport");
export type CreateTagInput = z.infer<typeof CreateTagInputSchema>;
export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>;
export type TagOutput = z.infer<typeof TagOutputSchema>;
export type TagsReportOutput = z.infer<typeof TagsReportOutputSchema>;

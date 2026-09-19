import { z } from "@hono/zod-openapi";
import { accountTypes } from "@openmonetis/domain/accounts";

export { accountTypes } from "@openmonetis/domain/accounts";

const AmountSchema = z.number().finite().multipleOf(0.01).min(-9999999999.99).max(9999999999.99);

const LogoSchema = z
  .string()
  .trim()
  .max(255)
  .refine((value) => value.startsWith("/logos/") || z.url().safeParse(value).success, {
    message: "Use a local /logos/ path or a valid URL",
  })
  .nullable()
  .optional();

export const CreateAccountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(accountTypes),
    logo: LogoSchema,
    note: z.string().trim().max(1000).nullable().optional(),
    excludeFromBalance: z.boolean().default(false),
  })
  .openapi("CreateAccountInput");

export const ReplaceAccountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(accountTypes),
    logo: LogoSchema,
    note: z.string().trim().max(1000).nullable().optional(),
    excludeFromBalance: z.boolean(),
    isArchived: z.boolean(),
  })
  .openapi("ReplaceAccountInput");

export const UpdateAccountInputSchema = ReplaceAccountInputSchema.partial()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdateAccountInput");

export const AdjustAccountBalanceInputSchema = z
  .object({
    balance: AmountSchema,
    date: z.iso.date(),
  })
  .openapi("AdjustAccountBalanceInput");

export const AccountBalanceAdjustmentPreviewSchema = z
  .object({
    currentBalance: z.number().finite(),
    desiredBalance: z.number().finite(),
    adjustmentAmount: z.number().finite(),
    date: z.iso.date(),
  })
  .openapi("AccountBalanceAdjustmentPreview");
export type AccountBalanceAdjustmentPreview = z.infer<typeof AccountBalanceAdjustmentPreviewSchema>;

export const AddAccountYieldInputSchema = z
  .discriminatedUnion("mode", [
    z.object({
      mode: z.literal("amount"),
      amount: AmountSchema.positive(),
      date: z.iso.date(),
    }),
    z.object({
      mode: z.literal("currentBalance"),
      balance: AmountSchema,
      date: z.iso.date(),
    }),
  ])
  .openapi("AddAccountYieldInput");

export const AccountParamsSchema = z
  .object({
    id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
  })
  .openapi("AccountParams");

export const AccountPeriodQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .openapi({ param: { name: "period", in: "query" }, example: "2026-07" }),
  })
  .openapi("AccountPeriodQuery");

export const AccountPeriodSummarySchema = z
  .object({
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    income: z.number().nonnegative(),
    expenses: z.number().nonnegative(),
    balance: z.number(),
  })
  .openapi("AccountPeriodSummary");

export const AccountOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(accountTypes),
    logo: z.string().nullable(),
    note: z.string().nullable(),
    excludeFromBalance: z.boolean(),
    isArchived: z.boolean(),
    summary: AccountPeriodSummarySchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("AccountOutput");

export const AccountBalanceAdjustmentOutputSchema = z
  .object({
    account: AccountOutputSchema,
    adjustmentCreated: z.boolean(),
  })
  .openapi("AccountBalanceAdjustmentOutput");

export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;
export type ReplaceAccountInput = z.infer<typeof ReplaceAccountInputSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;
export type AdjustAccountBalanceInput = z.infer<typeof AdjustAccountBalanceInputSchema>;
export type AddAccountYieldInput = z.infer<typeof AddAccountYieldInputSchema>;
export type AccountOutput = z.infer<typeof AccountOutputSchema>;
export type AccountBalanceAdjustmentOutput = z.infer<typeof AccountBalanceAdjustmentOutputSchema>;

import { z } from "@hono/zod-openapi";
import {
  cardBrands,
  cardClosingOffsetModes,
  cardClosingRuleTypes,
  cardInvoiceStatuses,
  cardStatuses,
} from "@openmonetis/domain/cards";

export {
  cardBrands,
  cardClosingOffsetModes,
  cardClosingRuleTypes,
  cardInvoiceStatuses,
  cardStatuses,
} from "@openmonetis/domain/cards";

const AmountSchema = z.number().finite().multipleOf(0.01).positive().max(9999999999.99);
const DayOfMonthSchema = z.number().int().min(1).max(31);
const LogoSchema = z
  .string()
  .trim()
  .max(255)
  .refine((value) => value.startsWith("/logos/") || z.url().safeParse(value).success, {
    message: "Use um caminho local /logos/ ou uma URL válida",
  })
  .nullable()
  .optional();

const CardInputSchema = z.object({
  accountId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  brand: z.enum(cardBrands),
  status: z.enum(cardStatuses),
  closingRuleType: z.enum(cardClosingRuleTypes),
  closingDay: DayOfMonthSchema.nullable().optional(),
  closingOffsetDays: z.number().int().min(1).max(31).nullable().optional(),
  closingOffsetMode: z.enum(cardClosingOffsetModes).nullable().optional(),
  dueDay: DayOfMonthSchema,
  limit: AmountSchema,
  logo: LogoSchema,
  note: z.string().trim().max(1000).nullable().optional(),
});

export const CreateCardInputSchema = CardInputSchema.extend({
  status: z.enum(cardStatuses).default("active"),
  closingRuleType: z.enum(cardClosingRuleTypes).default("fixedDay"),
})
  .superRefine((input, context) => {
    if (input.closingRuleType === "fixedDay" && input.closingDay == null) {
      context.addIssue({
        code: "custom",
        path: ["closingDay"],
        message: "Informe o dia de fechamento",
      });
    }
    if (
      input.closingRuleType === "daysBeforeDue" &&
      (input.closingOffsetDays == null || input.closingOffsetMode == null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["closingOffsetDays"],
        message: "Informe a quantidade e o tipo de contagem dos dias",
      });
    }
  })
  .openapi("CreateCardInput");

export const ReplaceCardInputSchema = CreateCardInputSchema.openapi("ReplaceCardInput");

export const UpdateCardInputSchema = CardInputSchema.partial()
  .superRefine((input, context) => {
    if (input.closingRuleType === "fixedDay" && input.closingDay == null) {
      context.addIssue({
        code: "custom",
        path: ["closingDay"],
        message: "Informe o dia ao selecionar o fechamento fixo",
      });
    }
    if (
      input.closingRuleType === "daysBeforeDue" &&
      (input.closingOffsetDays == null || input.closingOffsetMode == null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["closingOffsetDays"],
        message: "Informe a quantidade e o tipo de contagem dos dias",
      });
    }
  })
  .refine((input) => Object.keys(input).length > 0, "Informe ao menos um campo para atualizar")
  .openapi("UpdateCardInput");

export const CardParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("CardParams");

export const CardPeriodQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .openapi({ param: { name: "period", in: "query" }, example: "2026-07" }),
  })
  .openapi("CardPeriodQuery");

export const CardInvoicePeriodQuerySchema = z
  .object({
    purchaseDate: z.iso.date().openapi({
      param: { name: "purchaseDate", in: "query" },
      example: "2026-07-21",
    }),
  })
  .openapi("CardInvoicePeriodQuery");

export const CardInvoicePeriodOutputSchema = z
  .object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
  .openapi("CardInvoicePeriodOutput");

export const CardInvoiceSummarySchema = z
  .object({
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount: z.number().nonnegative(),
    status: z.enum(cardInvoiceStatuses),
    closingDate: z.iso.date(),
    dueDate: z.iso.date(),
    totalLimit: z.number().nonnegative(),
    usedLimit: z.number().nonnegative(),
    availableLimit: z.number().nonnegative(),
    usagePercentage: z.number().nonnegative(),
  })
  .openapi("CardInvoiceSummary");

export const CardInvoiceHistoryOutputSchema = z
  .object({
    items: z.array(
      z.object({
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        amount: z.number().nonnegative(),
      }),
    ),
  })
  .openapi("CardInvoiceHistoryOutput");

export const CardOutputSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    name: z.string(),
    brand: z.enum(cardBrands),
    status: z.enum(cardStatuses),
    closingRuleType: z.enum(cardClosingRuleTypes),
    closingDay: z.number().int().nullable(),
    closingOffsetDays: z.number().int().nullable(),
    closingOffsetMode: z.enum(cardClosingOffsetModes).nullable(),
    dueDay: z.number().int(),
    limit: z.number(),
    logo: z.string().nullable(),
    note: z.string().nullable(),
    invoiceSummary: CardInvoiceSummarySchema,
    cycleSpending: z.object({
      startDate: z.iso.date(),
      endDate: z.iso.date(),
      openingAmount: z.number(),
      daily: z.array(
        z.object({
          date: z.iso.date(),
          amount: z.number(),
          cumulativeAmount: z.number(),
        }),
      ),
    }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("CardOutput");

export type CreateCardInput = z.infer<typeof CreateCardInputSchema>;
export type ReplaceCardInput = z.infer<typeof ReplaceCardInputSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardInputSchema>;
export type CardInvoicePeriodOutput = z.infer<typeof CardInvoicePeriodOutputSchema>;
export type CardInvoiceHistoryOutput = z.infer<typeof CardInvoiceHistoryOutputSchema>;
export type CardOutput = z.infer<typeof CardOutputSchema>;

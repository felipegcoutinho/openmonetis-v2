import { z } from "@hono/zod-openapi";
import { paymentMethods, recurrenceFrequencies } from "@openmonetis/domain/transactions";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const dateSchema = z.iso.date();

export const ListRecurringExpensesQuerySchema = z
  .object({
    period: periodSchema.openapi({
      param: { name: "period", in: "query" },
      example: "2026-07",
    }),
  })
  .openapi("ListRecurringExpensesQuery");

export const RecurringExpenseParamsSchema = z
  .object({
    id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
    purchaseDate: dateSchema.openapi({ param: { name: "purchaseDate", in: "path" } }),
  })
  .openapi("RecurringExpenseParams");

export const UpdateRecurringExpenseInputSchema = z
  .object({
    scope: z.enum(["single", "future"]),
    name: z.string().trim().min(1).max(160),
    amount: z.number().finite().positive().max(9_999_999_999.99),
    splitShares: z
      .array(
        z.object({
          personId: z.uuid(),
          amount: z.number().finite().positive().max(9_999_999_999.99),
        }),
      )
      .min(2)
      .optional(),
  })
  .strict()
  .openapi("UpdateRecurringExpenseInput");

export const RecurringExpenseOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    amount: z.number().finite().positive(),
    totalAmount: z.number().finite().positive(),
    paymentMethod: z.enum(paymentMethods),
    frequency: z.enum(recurrenceFrequencies),
    purchaseDate: dateSchema,
    personName: z.string(),
    personAvatarUrl: z.string().nullable(),
    accountName: z.string().nullable(),
    accountLogo: z.string().nullable(),
    categoryName: z.string().nullable(),
    categoryIcon: z.string().nullable(),
    cardName: z.string().nullable(),
    cardLogo: z.string().nullable(),
    splitPeople: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        avatarUrl: z.string().nullable(),
        amount: z.number().finite().positive(),
      }),
    ),
    isSettled: z.boolean(),
    canEdit: z.boolean(),
    status: z.enum(["active", "paused"]),
  })
  .openapi("RecurringExpense");

export const RecurringExpensesOutputSchema = z
  .object({
    period: periodSchema,
    items: z.array(RecurringExpenseOutputSchema),
  })
  .openapi("RecurringExpenses");

export const RecurringExpensesReportItemSchema = RecurringExpenseOutputSchema.extend({
  actionDate: dateSchema.nullable(),
  nextOccurrenceDate: dateSchema.nullable(),
}).openapi("RecurringExpensesReportItem");

export const RecurringExpensesReportOutputSchema = z
  .object({
    period: periodSchema,
    summary: z.object({
      activeCount: z.number().int().nonnegative(),
      pausedCount: z.number().int().nonnegative(),
      projectedTotal: z.number().finite().nonnegative(),
    }),
    projections: z.array(
      z.object({
        period: periodSchema,
        total: z.number().finite().nonnegative(),
      }),
    ),
    items: z.array(RecurringExpensesReportItemSchema),
  })
  .openapi("RecurringExpensesReport");

export const RecurringExpenseActionOutputSchema = z
  .object({ success: z.literal(true) })
  .openapi("RecurringExpenseAction");

export type ListRecurringExpensesQuery = z.infer<typeof ListRecurringExpensesQuerySchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof UpdateRecurringExpenseInputSchema>;
export type RecurringExpenseOutput = z.infer<typeof RecurringExpenseOutputSchema>;
export type RecurringExpensesOutput = z.infer<typeof RecurringExpensesOutputSchema>;
export type RecurringExpensesReportOutput = z.infer<typeof RecurringExpensesReportOutputSchema>;

import { z } from "@hono/zod-openapi";
import { paymentMethods } from "@openmonetis/domain/transactions";
import { RecurringExpenseOutputSchema } from "./recurring-expenses";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

/** The report covers every series; projections always start at the current month. */
export const RecurringTransactionsReportQuerySchema = z
  .object({
    type: z
      .enum(["expense", "income"])
      .default("expense")
      .openapi({ param: { name: "type", in: "query" } }),
  })
  .openapi("RecurringTransactionsReportQuery");

export const RecurringTransactionsSearchSchema = z.object({
  type: z.enum(["expense", "income"]).default("expense").catch("expense"),
  status: z.enum(["active", "paused", "ended", "all"]).default("active").catch("active"),
  paymentMethod: z
    .enum(["all", ...paymentMethods])
    .default("all")
    .catch("all"),
  q: z.string().max(160).default("").catch(""),
});

export const RecurringTransactionReportItemSchema = RecurringExpenseOutputSchema.omit({
  status: true,
})
  .extend({
    seriesId: z.uuid(),
    type: z.enum(["expense", "income"]),
    status: z.enum(["active", "paused", "ended"]),
    actionDate: z.iso.date().nullable(),
    nextOccurrenceDate: z.iso.date().nullable(),
  })
  .openapi("RecurringTransactionReportItem");

export const RecurringTransactionsReportOutputSchema = z
  .object({
    period: periodSchema,
    type: z.enum(["expense", "income"]),
    summary: z.object({
      activeCount: z.number().int().nonnegative(),
      pausedCount: z.number().int().nonnegative(),
      endedCount: z.number().int().nonnegative(),
      projectedTotal: z.number().finite().nonnegative(),
      projectionTotal: z.number().finite().nonnegative(),
      monthlyAverage: z.number().finite().nonnegative(),
    }),
    projections: z.array(
      z.object({
        period: periodSchema,
        total: z.number().finite().nonnegative(),
      }),
    ),
    items: z.array(RecurringTransactionReportItemSchema),
  })
  .openapi("RecurringTransactionsReport");

export type RecurringTransactionsReportQuery = z.infer<
  typeof RecurringTransactionsReportQuerySchema
>;
export type RecurringTransactionsReportOutput = z.infer<
  typeof RecurringTransactionsReportOutputSchema
>;
export type RecurringTransactionReportItem = z.infer<typeof RecurringTransactionReportItemSchema>;
export type RecurringTransactionsSearch = z.infer<typeof RecurringTransactionsSearchSchema>;

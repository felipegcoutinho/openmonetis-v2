import { z } from "@hono/zod-openapi";
import { cardInvoiceStatuses } from "@openmonetis/domain/cards";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
export const ListInvoicesQuerySchema = z.object({
  period: periodSchema.openapi({ param: { name: "period", in: "query" } }),
});
export const InvoiceParamsSchema = z.object({
  cardId: z.uuid().openapi({ param: { name: "cardId", in: "path" } }),
  period: periodSchema.openapi({ param: { name: "period", in: "path" } }),
});
export const InvoicePaymentParamsSchema = InvoiceParamsSchema.extend({
  paymentId: z.uuid().openapi({ param: { name: "paymentId", in: "path" } }),
});
export const UpdateInvoiceDatesInputSchema = z
  .object({
    closingDate: z.iso.date(),
    dueDate: z.iso.date(),
  })
  .openapi("UpdateInvoiceDatesInput");
export const CreateInvoicePaymentInputSchema = z
  .object({
    accountId: z.uuid().nullable().optional(),
    paidAt: z.iso.date(),
    allocations: z
      .array(
        z.object({
          personId: z.uuid(),
          amount: z.number().positive().multipleOf(0.01).max(9999999999.99),
        }),
      )
      .min(1)
      .max(100),
  })
  .openapi("CreateInvoicePaymentInput");
export const AdjustInvoiceInputSchema = z
  .object({
    amount: z.number().nonnegative().multipleOf(0.01).max(9999999999.99),
    date: z.iso.date(),
    personId: z.uuid(),
  })
  .openapi("AdjustInvoiceInput");

export const InvoiceAdjustmentParamsSchema = InvoiceParamsSchema.extend({
  adjustmentId: z.uuid().openapi({ param: { name: "adjustmentId", in: "path" } }),
});

export const InvoicePersonBalanceSchema = z.object({
  personId: z.uuid(),
  personName: z.string(),
  personAvatarUrl: z.string().nullable(),
  personRole: z.enum(["admin", "external"]),
  amount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  remainingAmount: z.number().nonnegative(),
});
export const InvoicePaymentSummarySchema = z.object({
  id: z.uuid(),
  amount: z.number().positive(),
  paidAt: z.iso.date(),
});
export const DashboardInvoiceSchema = z.object({
  cardId: z.uuid(),
  accountId: z.uuid(),
  cardName: z.string(),
  logo: z.string().nullable(),
  period: periodSchema,
  amount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  remainingAmount: z.number().nonnegative(),
  status: z.enum(cardInvoiceStatuses),
  closingDate: z.iso.date(),
  dueDate: z.iso.date(),
  paymentCount: z.number().int().nonnegative(),
  latestPayment: InvoicePaymentSummarySchema.nullable(),
  payments: z.array(InvoicePaymentSummarySchema),
  people: z.array(InvoicePersonBalanceSchema),
});
export const InvoicePaymentOptionsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  logo: z.string().nullable(),
});
export const DashboardInvoicesOutputSchema = z
  .object({
    period: periodSchema,
    totalRemaining: z.number().nonnegative(),
    accounts: z.array(InvoicePaymentOptionsSchema),
    items: z.array(DashboardInvoiceSchema),
  })
  .openapi("DashboardInvoices");
export const InvoicePaymentOutputSchema = z.object({
  id: z.uuid(),
  amount: z.number().positive(),
  accountAmount: z.number().nonnegative(),
  remainingAmount: z.number().nonnegative(),
  status: z.enum(cardInvoiceStatuses),
});
export const UndoInvoicePaymentOutputSchema = z.object({
  id: z.uuid(),
  amount: z.number().positive(),
});
export const InvoiceAdjustmentOutputSchema = z.object({
  id: z.uuid().nullable(),
  previousAmount: z.number().nonnegative(),
  currentAmount: z.number().nonnegative(),
  adjustmentAmount: z.number().nonnegative(),
  type: z.literal("expense").nullable(),
});
export const ReopenInvoiceOutputSchema = z.object({
  reversedPaymentCount: z.number().int().nonnegative(),
  reversedAmount: z.number().nonnegative(),
});
export const RemoveInvoiceAdjustmentOutputSchema = z.object({
  id: z.uuid(),
});

export type CreateInvoicePaymentInput = z.infer<typeof CreateInvoicePaymentInputSchema>;
export type AdjustInvoiceInput = z.infer<typeof AdjustInvoiceInputSchema>;
export type UpdateInvoiceDatesInput = z.infer<typeof UpdateInvoiceDatesInputSchema>;
export type DashboardInvoice = z.infer<typeof DashboardInvoiceSchema>;
export type DashboardInvoicesOutput = z.infer<typeof DashboardInvoicesOutputSchema>;
export type InvoicePaymentOutput = z.infer<typeof InvoicePaymentOutputSchema>;
export type UndoInvoicePaymentOutput = z.infer<typeof UndoInvoicePaymentOutputSchema>;
export type InvoiceAdjustmentOutput = z.infer<typeof InvoiceAdjustmentOutputSchema>;
export type ReopenInvoiceOutput = z.infer<typeof ReopenInvoiceOutputSchema>;
export type RemoveInvoiceAdjustmentOutput = z.infer<typeof RemoveInvoiceAdjustmentOutputSchema>;

import { z } from "@hono/zod-openapi";
import { billStatuses } from "@openmonetis/domain/bills";
import { recurrenceFrequencies, transactionConditions } from "@openmonetis/domain/transactions";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

export const ListBillsQuerySchema = z.object({
  period: periodSchema.openapi({ param: { name: "period", in: "query" } }),
});

export const BillPaymentParamsSchema = z.object({
  period: periodSchema.openapi({ param: { name: "period", in: "path" } }),
});

export const CreateBillPaymentInputSchema = z
  .object({
    billId: z.string().min(1),
    accountId: z.uuid(),
    paidAt: z.iso.date(),
  })
  .openapi("CreateBillPaymentInput");

export const BillPersonSchema = z.object({
  personId: z.uuid(),
  personName: z.string(),
  personAvatarUrl: z.string().nullable(),
  amount: z.number().positive(),
});

export const DashboardBillSchema = z.object({
  id: z.string(),
  recordId: z.uuid().nullable(),
  recurringRuleId: z.uuid().nullable(),
  purchaseDate: z.iso.date(),
  period: periodSchema,
  name: z.string(),
  amount: z.number().positive(),
  dueDate: z.iso.date(),
  boletoPaymentDate: z.iso.date().nullable(),
  isSettled: z.boolean(),
  status: z.enum(billStatuses),
  condition: z.enum(transactionConditions),
  currentInstallment: z.number().int().positive().nullable(),
  installmentCount: z.number().int().positive().nullable(),
  recurrenceFrequency: z.enum(recurrenceFrequencies).nullable(),
  accountId: z.uuid().nullable(),
  accountName: z.string().nullable(),
  accountLogo: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  people: z.array(BillPersonSchema).min(1),
});

export const DashboardBillsOutputSchema = z
  .object({
    period: periodSchema,
    totalOpen: z.number().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    accounts: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        logo: z.string().nullable(),
      }),
    ),
    items: z.array(DashboardBillSchema),
  })
  .openapi("DashboardBills");

export type DashboardBill = z.infer<typeof DashboardBillSchema>;
export type DashboardBillsOutput = z.infer<typeof DashboardBillsOutputSchema>;
export type CreateBillPaymentInput = z.infer<typeof CreateBillPaymentInputSchema>;

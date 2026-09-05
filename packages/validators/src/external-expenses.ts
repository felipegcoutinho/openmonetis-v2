import { z } from "@hono/zod-openapi";
import { cardBrands } from "@openmonetis/domain/cards";
import {
  externalExpenseSourceKinds,
  externalExpenseStatuses,
} from "@openmonetis/domain/external-expenses";
import { paymentMethods, transactionConditions } from "@openmonetis/domain/transactions";
import { TransactionInputSchema, TransactionOutputSchema } from "./transactions";

export const ExternalExpenseParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});

export const ListExternalExpensesQuerySchema = z
  .object({
    view: z.enum(["pending", "imported"]).default("pending"),
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .openapi("ListExternalExpensesQuery");

export const ImportExternalExpenseInputSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    transaction: TransactionInputSchema,
  })
  .strict()
  .openapi("ImportExternalExpenseInput");

export const ExternalExpenseSnapshotSchema = z
  .object({
    name: z.string().min(1).max(160),
    amount: z.number().positive(),
    purchaseDate: z.iso.date(),
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    dueDate: z.iso.date().nullable(),
    paymentMethod: z.enum(paymentMethods),
    condition: z.enum(transactionConditions),
    installmentCount: z.number().int().min(2).max(60).nullable(),
    currentInstallment: z.number().int().positive().nullable(),
    sourceLabel: z.string().max(120).nullable(),
  })
  .openapi("ExternalExpenseSnapshot");

export const ExternalExpenseOutputSchema = z
  .object({
    id: z.uuid(),
    connectionId: z.uuid(),
    sourceKind: z.enum(externalExpenseSourceKinds),
    sourceTransactionId: z.uuid().nullable(),
    sourceSeriesId: z.uuid().nullable(),
    sourceRecurringSeriesId: z.uuid().nullable(),
    sourceRecurringRuleId: z.uuid().nullable(),
    sourceOccurrenceDate: z.iso.date().nullable(),
    importedTransactionId: z.uuid().nullable(),
    counterpartName: z.string(),
    counterpartAvatarUrl: z.url().nullable(),
    status: z.enum(externalExpenseStatuses),
    sourceVersion: z.number().int().positive(),
    snapshot: ExternalExpenseSnapshotSchema,
    sourceLogoUrl: z.string().max(255).nullable(),
    sourceCardBrand: z.enum(cardBrands).nullable(),
    importedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ExternalExpense");

export const ExternalExpensePageOutputSchema = z
  .object({
    items: z.array(ExternalExpenseOutputSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalAmount: z.number().nonnegative(),
    totalPages: z.number().int().positive(),
  })
  .openapi("ExternalExpensePage");

export const ImportExternalExpenseOutputSchema = z
  .object({
    expense: ExternalExpenseOutputSchema,
    transaction: TransactionOutputSchema,
  })
  .openapi("ImportExternalExpenseOutput");

export const ExternalExpenseSummaryOutputSchema = z
  .object({
    pendingCount: z.number().int().nonnegative(),
    totalAmount: z.number().nonnegative(),
    counterpartCount: z.number().int().nonnegative(),
    latestCounterpartName: z.string().nullable(),
    latestUpdatedAt: z.iso.datetime().nullable(),
    latestPeriod: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable(),
  })
  .openapi("ExternalExpenseSummary");

export type ListExternalExpensesQuery = z.infer<typeof ListExternalExpensesQuerySchema>;
export type ImportExternalExpenseInput = z.infer<typeof ImportExternalExpenseInputSchema>;
export type ImportExternalExpenseOutput = z.infer<typeof ImportExternalExpenseOutputSchema>;
export type ExternalExpenseOutput = z.infer<typeof ExternalExpenseOutputSchema>;
export type ExternalExpensePageOutput = z.infer<typeof ExternalExpensePageOutputSchema>;
export type ExternalExpenseSummaryOutput = z.infer<typeof ExternalExpenseSummaryOutputSchema>;

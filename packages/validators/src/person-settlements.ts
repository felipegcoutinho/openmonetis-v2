import { z } from "@hono/zod-openapi";

export const PersonSettlementParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("PersonSettlementParams");

export const PersonSettlementPersonParamsSchema = z
  .object({ personId: z.uuid().openapi({ param: { name: "personId", in: "path" } }) })
  .openapi("PersonSettlementPersonParams");

export const PersonSettlementPeriodQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
      .openapi({ param: { name: "period", in: "query" }, example: "2026-08" }),
  })
  .openapi("PersonSettlementPeriodQuery");

export const CreatePersonSettlementInputSchema = z
  .object({
    personId: z.uuid(),
    amount: z.number().finite().positive().max(999999999.99),
    receivedAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[0-1])$/),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .openapi("CreatePersonSettlementInput");

export const PersonSettlementOutputSchema = z
  .object({
    id: z.uuid(),
    personId: z.uuid(),
    amount: z.number(),
    receivedAt: z.iso.date(),
    note: z.string().nullable(),
    source: z.enum(["manual", "invoicePayment"]),
    createdAt: z.iso.datetime(),
  })
  .openapi("PersonSettlementOutput");

export const PersonBalanceOutputSchema = z
  .object({
    assignedAmount: z.number(),
    refundedAmount: z.number(),
    settledAmount: z.number(),
    balanceAmount: z.number(),
    receivableAmount: z.number(),
    creditAmount: z.number(),
    status: z.enum(["receivable", "settled", "credit"]),
  })
  .openapi("PersonBalanceOutput");

export const PersonSettlementSnapshotOutputSchema = z
  .object({
    personId: z.uuid(),
    period: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
    balance: PersonBalanceOutputSchema,
    settlements: z.array(PersonSettlementOutputSchema),
  })
  .openapi("PersonSettlementSnapshotOutput");

export const PersonSettlementSummaryItemOutputSchema = z
  .object({
    personId: z.uuid(),
    personName: z.string(),
    personAvatarUrl: z.string().nullable(),
    personStatus: z.enum(["active", "inactive"]),
    balance: PersonBalanceOutputSchema,
  })
  .openapi("PersonSettlementSummaryItemOutput");

export const PersonSettlementsSummaryOutputSchema = z
  .object({
    period: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
    totalReceivableAmount: z.number().finite().nonnegative(),
    totalCreditAmount: z.number().finite().nonnegative(),
    items: z.array(PersonSettlementSummaryItemOutputSchema),
  })
  .openapi("PersonSettlementsSummaryOutput");

export type CreatePersonSettlementInput = z.infer<typeof CreatePersonSettlementInputSchema>;
export type PersonSettlementOutput = z.infer<typeof PersonSettlementOutputSchema>;
export type PersonBalanceOutput = z.infer<typeof PersonBalanceOutputSchema>;
export type PersonSettlementSnapshotOutput = z.infer<typeof PersonSettlementSnapshotOutputSchema>;
export type PersonSettlementSummaryItemOutput = z.infer<
  typeof PersonSettlementSummaryItemOutputSchema
>;
export type PersonSettlementsSummaryOutput = z.infer<typeof PersonSettlementsSummaryOutputSchema>;

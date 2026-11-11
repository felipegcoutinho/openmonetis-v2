import { z } from "@hono/zod-openapi";
import {
  installmentDiscountTypes,
  installmentPaymentStatuses,
  installmentSeriesStatuses,
} from "@openmonetis/domain/installments";
import {
  maximumInstallmentCount,
  minimumInstallmentCount,
  paymentMethods,
} from "@openmonetis/domain/transactions";

export { installmentDiscountTypes, installmentPaymentStatuses, installmentSeriesStatuses };

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const moneySchema = z.number().finite().nonnegative();

export const DashboardInstallmentsQuerySchema = z
  .object({
    period: periodSchema.openapi({
      param: { name: "period", in: "query" },
      example: "2026-07",
    }),
  })
  .openapi("DashboardInstallmentsQuery");

/**
 * The report lists what is still open plus what finishes in the current month (in Brazil) or
 * later; finished purchases from earlier months are left out.
 */
export const ListInstallmentsQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(160)
      .optional()
      .openapi({
        param: { name: "q", in: "query" },
        example: "notebook",
      }),
  })
  .openapi("ListInstallmentsQuery");

export const InstallmentOutputSchema = z
  .object({
    id: z.uuid(),
    installmentNumber: z.number().int().positive(),
    period: periodSchema,
    purchaseDate: z.iso.date(),
    amount: moneySchema,
    dueDate: z.iso.date().nullable(),
    status: z.enum(installmentPaymentStatuses),
    isDueInReferencePeriod: z.boolean(),
  })
  .openapi("Installment");

export const InstallmentGroupOutputSchema = z
  .object({
    seriesId: z.uuid(),
    name: z.string(),
    note: z.string().nullable(),
    paymentMethod: z.enum(paymentMethods),
    originalAmount: moneySchema,
    totalInstallments: z.number().int().positive(),
    trackedFromInstallment: z.number().int().positive(),
    trackedInstallmentCount: z.number().int().nonnegative(),
    untrackedInstallmentCount: z.number().int().nonnegative(),
    scheduledInstallmentCount: z.number().int().nonnegative(),
    missingInstallmentCount: z.number().int().nonnegative(),
    paidInstallmentCount: z.number().int().nonnegative(),
    pendingInstallmentCount: z.number().int().nonnegative(),
    overdueInstallmentCount: z.number().int().nonnegative(),
    trackedAmount: moneySchema,
    paidAmount: moneySchema,
    pendingAmount: moneySchema,
    progressPercentage: z.number().finite().min(0).max(100),
    nextDueDate: z.iso.date().nullable(),
    nextPeriod: periodSchema.nullable(),
    endPeriod: periodSchema.nullable(),
    status: z.enum(installmentSeriesStatuses),
    personId: z.uuid(),
    personName: z.string(),
    personAvatarUrl: z.string().nullable(),
    categoryId: z.uuid().nullable(),
    categoryName: z.string().nullable(),
    categoryIcon: z.string().nullable(),
    cardId: z.uuid().nullable(),
    cardName: z.string().nullable(),
    cardLogo: z.string().nullable(),
    accountId: z.uuid().nullable(),
    accountName: z.string().nullable(),
    accountLogo: z.string().nullable(),
    installments: z.array(InstallmentOutputSchema),
  })
  .openapi("InstallmentGroup");

export const InstallmentsSummaryOutputSchema = z
  .object({
    openSeriesCount: z.number().int().nonnegative(),
    totalPendingAmount: moneySchema,
    dueInPeriodAmount: moneySchema,
    overdueAmount: moneySchema,
    lastInstallmentPeriod: periodSchema.nullable(),
    trackedAmount: moneySchema,
    paidInstallmentCount: z.number().int().nonnegative(),
    pendingInstallmentCount: z.number().int().nonnegative(),
    trackedInstallmentCount: z.number().int().nonnegative(),
    untrackedInstallmentCount: z.number().int().nonnegative(),
    missingInstallmentCount: z.number().int().nonnegative(),
  })
  .openapi("InstallmentsSummary");

export const InstallmentsReportOutputSchema = z
  .object({
    referencePeriod: periodSchema,
    upcomingMonths: z.array(
      z.object({
        period: periodSchema,
        totalAmount: moneySchema,
        activePurchaseCount: z.number().int().nonnegative(),
      }),
    ),
    summary: InstallmentsSummaryOutputSchema,
    groups: z.array(InstallmentGroupOutputSchema),
  })
  .openapi("InstallmentsReport");

export const DashboardInstallmentExpensesOutputSchema = z
  .object({
    period: periodSchema,
    items: z.array(
      z.object({
        amount: moneySchema,
        categoryIcon: z.string().nullable(),
        currentInstallment: z.number().int().positive(),
        endPeriod: periodSchema.nullable(),
        isPaid: z.boolean(),
        name: z.string(),
        pendingAmount: moneySchema,
        pendingInstallmentCount: z.number().int().nonnegative(),
        personAvatarUrl: z.string().nullable(),
        personName: z.string(),
        progressPercentage: z.number().finite().min(0).max(100),
        seriesId: z.uuid(),
        totalInstallments: z.number().int().positive(),
      }),
    ),
  })
  .openapi("DashboardInstallmentExpenses");

export const QuoteInstallmentsInputSchema = z
  .object({
    installmentIds: z
      .array(z.uuid())
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Installment IDs must be unique"),
  })
  .openapi("QuoteInstallmentsInput");

/** A hypothetical credit card purchase: nothing is saved and no other report changes. */
export const SimulateInstallmentPurchaseInputSchema = z
  .object({
    amount: z.number().positive().multipleOf(0.01).max(999_999_999.99).openapi({ example: 3600 }),
    installmentCount: z
      .number()
      .int()
      .min(minimumInstallmentCount)
      .max(maximumInstallmentCount)
      .openapi({ example: 10 }),
    cardId: z.uuid(),
    name: z.string().trim().min(1).max(120).optional().openapi({ example: "Geladeira nova" }),
    /** Invoice of the first installment; when omitted it follows the card's closing rule. */
    invoicePeriod: periodSchema.optional().openapi({ example: "2026-12" }),
  })
  .openapi("SimulateInstallmentPurchaseInput");

export const InstallmentPurchaseSimulationOutputSchema = z
  .object({
    cardId: z.uuid(),
    cardName: z.string(),
    cardLogo: z.string().nullable(),
    name: z.string().nullable(),
    /** Whether the first invoice was chosen by the user instead of the card's closing rule. */
    invoicePeriodChosen: z.boolean(),
    amount: moneySchema,
    installmentCount: z.number().int().positive(),
    installmentAmount: moneySchema,
    firstPeriod: periodSchema,
    endPeriod: periodSchema,
    installments: z.array(
      z.object({
        installmentNumber: z.number().int().positive(),
        period: periodSchema,
        amount: moneySchema,
      }),
    ),
    upcomingMonths: z.array(z.object({ period: periodSchema, amount: moneySchema })),
  })
  .openapi("InstallmentPurchaseSimulation");

/** A hypothetical early payoff: nothing is saved and no other report changes. */
export const SimulateInstallmentPayoffInputSchema = z
  .object({
    installmentIds: z
      .array(z.uuid())
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Installment IDs must be unique"),
    discounts: z
      .array(
        z
          .object({
            seriesId: z.uuid(),
            type: z.enum(installmentDiscountTypes),
            value: z.number().finite().nonnegative().multipleOf(0.01).max(999_999_999.99),
          })
          .refine((discount) => discount.type !== "percentage" || discount.value <= 100, {
            path: ["value"],
            message: "Percentage discount cannot exceed 100",
          }),
      )
      .max(500)
      .refine(
        (discounts) => new Set(discounts.map((item) => item.seriesId)).size === discounts.length,
        "Each purchase can have only one discount",
      )
      .default([]),
  })
  .openapi("SimulateInstallmentPayoffInput");

export const InstallmentPayoffSimulationOutputSchema = z
  .object({
    payoffPeriod: periodSchema,
    installmentCount: z.number().int().positive(),
    totalAmount: moneySchema,
    discountAmount: moneySchema,
    discountPercentage: z.number().finite().min(0).max(100),
    payoffAmount: moneySchema,
    nextMonthReliefAmount: moneySchema,
    lastInstallmentPeriod: z.object({
      current: periodSchema.nullable(),
      simulated: periodSchema.nullable(),
    }),
    upcomingMonths: z.array(
      z.object({
        period: periodSchema,
        keptAmount: moneySchema,
        releasedAmount: moneySchema,
        payoffAmount: moneySchema,
      }),
    ),
    series: z.array(
      z.object({
        seriesId: z.uuid(),
        releasedInstallmentCount: z.number().int().positive(),
        releasedAmount: moneySchema,
        discountOutOfRange: z.boolean(),
        discountAmount: moneySchema,
        discountPercentage: z.number().finite().min(0).max(100),
        payoffAmount: moneySchema,
        remainingInstallmentCount: z.number().int().nonnegative(),
        remainingAmount: moneySchema,
        endPeriod: periodSchema,
      }),
    ),
  })
  .openapi("InstallmentPayoffSimulation");

export const InstallmentSeriesParamsSchema = z.object({
  seriesId: z.uuid().openapi({ param: { name: "seriesId", in: "path" } }),
});

export const InstallmentAnticipationParamsSchema = InstallmentSeriesParamsSchema.extend({
  anticipationId: z.uuid().openapi({ param: { name: "anticipationId", in: "path" } }),
});

export const CreateInstallmentAnticipationInputSchema = z
  .object({
    installmentIds: z
      .array(z.uuid())
      .min(1)
      .max(60)
      .refine((ids) => new Set(ids).size === ids.length, "Installment IDs must be unique"),
    targetPeriod: periodSchema,
    discount: z.number().finite().nonnegative().multipleOf(0.01).max(999_999_999.99).default(0),
  })
  .openapi("CreateInstallmentAnticipationInput");

export const InstallmentQuoteOutputSchema = z
  .object({
    installmentCount: z.number().int().positive(),
    totalAmount: moneySchema,
  })
  .openapi("InstallmentQuote");

export const InstallmentAnticipationOutputSchema = z
  .object({
    id: z.uuid(),
    seriesId: z.uuid(),
    targetPeriod: periodSchema,
    installmentCount: z.number().int().positive(),
    totalAmount: moneySchema,
    discount: moneySchema,
    finalAmount: moneySchema,
  })
  .openapi("InstallmentAnticipation");

export const InstallmentAnticipationDetailsOutputSchema = z
  .object({
    id: z.uuid(),
    seriesId: z.uuid(),
    targetPeriod: periodSchema,
    discount: moneySchema,
    installments: z.array(
      z.object({
        id: z.uuid(),
        installmentNumber: z.number().int().positive(),
        totalInstallments: z.number().int().positive(),
        amount: moneySchema,
        originalPeriod: periodSchema,
      }),
    ),
  })
  .openapi("InstallmentAnticipationDetails");

export const UndoInstallmentAnticipationInputSchema = z
  .object({
    installmentIds: z
      .array(z.uuid())
      .min(1)
      .max(60)
      .refine((ids) => new Set(ids).size === ids.length, "Installment IDs must be unique"),
  })
  .openapi("UndoInstallmentAnticipationInput");

export const UndoInstallmentAnticipationOutputSchema = z
  .object({
    id: z.uuid(),
    restoredInstallmentCount: z.number().int().positive(),
    remainingInstallmentCount: z.number().int().nonnegative(),
    restoredDiscount: moneySchema,
    remainingDiscount: moneySchema,
  })
  .openapi("UndoInstallmentAnticipation");

export type ListInstallmentsQuery = z.infer<typeof ListInstallmentsQuerySchema>;
export type InstallmentOutput = z.infer<typeof InstallmentOutputSchema>;
export type InstallmentGroupOutput = z.infer<typeof InstallmentGroupOutputSchema>;
export type InstallmentsReportOutput = z.infer<typeof InstallmentsReportOutputSchema>;
export type DashboardInstallmentExpensesOutput = z.infer<
  typeof DashboardInstallmentExpensesOutputSchema
>;
export type QuoteInstallmentsInput = z.infer<typeof QuoteInstallmentsInputSchema>;
export type InstallmentQuoteOutput = z.infer<typeof InstallmentQuoteOutputSchema>;
export type SimulateInstallmentPurchaseInput = z.infer<
  typeof SimulateInstallmentPurchaseInputSchema
>;
export type InstallmentPurchaseSimulationOutput = z.infer<
  typeof InstallmentPurchaseSimulationOutputSchema
>;
export type SimulateInstallmentPayoffInput = z.infer<typeof SimulateInstallmentPayoffInputSchema>;
export type InstallmentPayoffSimulationOutput = z.infer<
  typeof InstallmentPayoffSimulationOutputSchema
>;
export type CreateInstallmentAnticipationInput = z.infer<
  typeof CreateInstallmentAnticipationInputSchema
>;
export type InstallmentAnticipationOutput = z.infer<typeof InstallmentAnticipationOutputSchema>;
export type InstallmentAnticipationDetailsOutput = z.infer<
  typeof InstallmentAnticipationDetailsOutputSchema
>;
export type UndoInstallmentAnticipationInput = z.infer<
  typeof UndoInstallmentAnticipationInputSchema
>;
export type UndoInstallmentAnticipationOutput = z.infer<
  typeof UndoInstallmentAnticipationOutputSchema
>;

import { z } from "@hono/zod-openapi";
import { budgetStatuses } from "@openmonetis/domain/budgets";

export { budgetStatuses } from "@openmonetis/domain/budgets";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const amountSchema = z.number().finite().multipleOf(0.01).positive().max(9_999_999_999.99);

export const CreateBudgetInputSchema = z
  .object({
    categoryId: z.uuid(),
    period: periodSchema,
    amount: amountSchema,
  })
  .openapi("CreateBudgetInput");

export const UpdateBudgetInputSchema = z
  .object({ amount: amountSchema.optional(), period: periodSchema.optional() })
  .refine(
    (input) => input.amount !== undefined || input.period !== undefined,
    "Provide at least one field to update",
  )
  .openapi("UpdateBudgetInput");

export const CopyPreviousBudgetsInputSchema = z
  .object({
    period: periodSchema,
    sourceBudgetIds: z
      .array(z.uuid())
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Budget IDs must be unique"),
  })
  .openapi("CopyPreviousBudgetsInput");

export const ListBudgetsQuerySchema = z
  .object({
    period: periodSchema.openapi({ param: { name: "period", in: "query" }, example: "2026-07" }),
  })
  .openapi("ListBudgetsQuery");

export const BudgetParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("BudgetParams");

export const BudgetOutputSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    categoryName: z.string(),
    categoryIcon: z.string().nullable(),
    period: periodSchema,
    amount: z.number().nonnegative(),
    actualSpentAmount: z.number().nonnegative(),
    projectedAmount: z.number().nonnegative(),
    committedAmount: z.number().nonnegative(),
    remainingAmount: z.number().nonnegative(),
    exceededAmount: z.number().nonnegative(),
    usagePercentage: z.number().nonnegative(),
    status: z.enum(budgetStatuses),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Budget");

export const BudgetOverviewOutputSchema = z
  .object({
    period: periodSchema,
    allocatedAmount: z.number().nonnegative(),
    actualSpentAmount: z.number().nonnegative(),
    projectedAmount: z.number().nonnegative(),
    committedAmount: z.number().nonnegative(),
    availableAmount: z.number().nonnegative(),
    exceededAmount: z.number().nonnegative(),
    unbudgetedCommittedAmount: z.number().nonnegative(),
    unbudgetedItems: z.array(
      z.object({
        categoryId: z.uuid().nullable(),
        committedAmount: z.number().nonnegative(),
      }),
    ),
    warningCount: z.number().int().nonnegative(),
    items: z.array(BudgetOutputSchema),
  })
  .openapi("BudgetOverview");

export const CopyPreviousBudgetsOutputSchema = z
  .object({
    createdCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
  })
  .openapi("CopyPreviousBudgetsOutput");

export type CreateBudgetInput = z.infer<typeof CreateBudgetInputSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;
export type CopyPreviousBudgetsInput = z.infer<typeof CopyPreviousBudgetsInputSchema>;
export type ListBudgetsQuery = z.infer<typeof ListBudgetsQuerySchema>;
export type BudgetOutput = z.infer<typeof BudgetOutputSchema>;
export type BudgetOverviewOutput = z.infer<typeof BudgetOverviewOutputSchema>;
export type CopyPreviousBudgetsOutput = z.infer<typeof CopyPreviousBudgetsOutputSchema>;

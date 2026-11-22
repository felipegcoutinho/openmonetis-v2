import { z } from "@hono/zod-openapi";
import { budgetRuleEditScopes, budgetStatuses } from "@openmonetis/domain/budgets";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const amountSchema = z.number().finite().multipleOf(0.01).positive().max(9_999_999_999.99);

export const CreateBudgetInputSchema = z
  .object({
    categoryId: z.uuid(),
    period: periodSchema,
    amount: amountSchema,
    /** Repeats the limit every month from `period` on instead of only in `period`. */
    repeatMonthly: z.boolean().optional(),
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
    /** Copies each limit as a recurring budget starting in `period`. */
    repeatMonthly: z.boolean().optional(),
  })
  .openapi("CopyPreviousBudgetsInput");

export const BudgetRuleParamsSchema = z
  .object({ ruleId: z.uuid().openapi({ param: { name: "ruleId", in: "path" } }) })
  .openapi("BudgetRuleParams");

export const UpdateBudgetRuleInputSchema = z
  .object({
    /** `single` adjusts only `period`; `future` changes the limit from `period` on. */
    scope: z.enum(budgetRuleEditScopes),
    period: periodSchema,
    amount: amountSchema,
  })
  .openapi("UpdateBudgetRuleInput");

export const StopBudgetRuleInputSchema = z
  .object({ period: periodSchema })
  .openapi("StopBudgetRuleInput");

export const StoppedBudgetRuleOutputSchema = z
  .object({
    id: z.uuid(),
    /** Last month the rule still applies, or `null` when it was removed entirely. */
    endPeriod: periodSchema.nullable(),
    deleted: z.boolean(),
  })
  .openapi("StoppedBudgetRule");

export const ListBudgetsQuerySchema = z
  .object({
    period: periodSchema.openapi({ param: { name: "period", in: "query" }, example: "2026-07" }),
  })
  .openapi("ListBudgetsQuery");

export const BudgetParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("BudgetParams");

export const BudgetRecurrenceSchema = z
  .object({
    ruleId: z.uuid(),
    startPeriod: periodSchema,
    endPeriod: periodSchema.nullable(),
  })
  .openapi("BudgetRecurrence");

export const BudgetOutputSchema = z
  .object({
    /** The month's budget id, or `ruleId:period` for a month covered only by a recurring rule. */
    id: z.string(),
    /** The month's own budget: a one-off limit, or the adjustment of a recurring one. */
    budgetId: z.uuid().nullable(),
    recurrence: BudgetRecurrenceSchema.nullable(),
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
    usagePercentage: z.number().nonnegative(),
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
export type UpdateBudgetRuleInput = z.infer<typeof UpdateBudgetRuleInputSchema>;
export type StopBudgetRuleInput = z.infer<typeof StopBudgetRuleInputSchema>;
export type StoppedBudgetRuleOutput = z.infer<typeof StoppedBudgetRuleOutputSchema>;

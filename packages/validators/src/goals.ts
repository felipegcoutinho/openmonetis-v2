import { z } from "@hono/zod-openapi";
import {
  goalContributionKinds,
  goalContributionMovements,
  goalPaceStatuses,
  goalStatuses,
  goalTrackingTypes,
} from "@openmonetis/domain/goals";

const amountSchema = z.number().finite().multipleOf(0.01).nonnegative().max(9_999_999_999.99);
const targetAmountSchema = amountSchema.positive();
const targetDateSchema = z.iso.date().nullable();

export const CreateGoalInputSchema = z
  .discriminatedUnion("trackingType", [
    z.object({
      name: z.string().trim().min(1).max(120),
      targetAmount: targetAmountSchema,
      currentAmount: amountSchema,
      targetDate: targetDateSchema,
      trackingType: z.literal("manual"),
    }),
    z.object({
      name: z.string().trim().min(1).max(120),
      targetAmount: targetAmountSchema,
      targetDate: targetDateSchema,
      trackingType: z.literal("account"),
      accountId: z.uuid(),
    }),
  ])
  .openapi("CreateGoalInput");

export const UpdateGoalInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    targetAmount: targetAmountSchema.optional(),
    currentAmount: amountSchema.optional(),
    targetDate: targetDateSchema.optional(),
    status: z.enum(goalStatuses).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one field to update")
  .openapi("UpdateGoalInput");

export const GoalParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("GoalParams");

export const GoalOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    targetAmount: z.number().positive(),
    currentAmount: z.number().nonnegative(),
    remainingAmount: z.number().nonnegative(),
    progressPercentage: z.number().nonnegative(),
    targetDate: targetDateSchema,
    trackingType: z.enum(goalTrackingTypes),
    accountId: z.uuid().nullable(),
    accountName: z.string().nullable(),
    accountLogo: z.string().nullable(),
    status: z.enum(goalStatuses),
    paceStatus: z.enum(goalPaceStatuses).nullable(),
    requiredMonthlyAmount: z.number().positive().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Goal");

export const CreateGoalContributionInputSchema = z
  .object({
    movement: z.enum(goalContributionMovements),
    amount: amountSchema.positive(),
    date: z.iso.date(),
    note: z.string().trim().min(1).max(240).nullable().optional(),
  })
  .openapi("CreateGoalContributionInput");

export const GoalContributionParamsSchema = z
  .object({
    id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
    contributionId: z.uuid().openapi({ param: { name: "contributionId", in: "path" } }),
  })
  .openapi("GoalContributionParams");

export const GoalContributionOutputSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(goalContributionKinds),
    amount: z.number(),
    date: z.iso.date(),
    note: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("GoalContribution");

export const GoalContributionHistoryEntrySchema = z
  .object({
    period: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/),
    deposits: z.number().nonnegative(),
    withdrawals: z.number().nonnegative(),
    balance: z.number(),
  })
  .openapi("GoalContributionHistoryEntry");

export const GoalContributionsOutputSchema = z
  .object({
    items: z.array(GoalContributionOutputSchema),
    history: z.array(GoalContributionHistoryEntrySchema),
  })
  .openapi("GoalContributions");

export const CreatedGoalContributionOutputSchema = z
  .object({ goal: GoalOutputSchema, contribution: GoalContributionOutputSchema })
  .openapi("CreatedGoalContribution");

export const RemovedGoalContributionOutputSchema = z
  .object({ goal: GoalOutputSchema })
  .openapi("RemovedGoalContribution");

export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;
export type GoalOutput = z.infer<typeof GoalOutputSchema>;
export type CreateGoalContributionInput = z.infer<typeof CreateGoalContributionInputSchema>;
export type GoalContributionOutput = z.infer<typeof GoalContributionOutputSchema>;
export type GoalContributionsOutput = z.infer<typeof GoalContributionsOutputSchema>;
export type CreatedGoalContributionOutput = z.infer<typeof CreatedGoalContributionOutputSchema>;
export type RemovedGoalContributionOutput = z.infer<typeof RemovedGoalContributionOutputSchema>;

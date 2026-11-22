import { z } from "@hono/zod-openapi";
import {
  commitmentStatuses,
  countCommitmentMonths,
  defaultCommitmentMonths,
  maxCommitmentMonths,
} from "@openmonetis/domain/commitments";

export { defaultCommitmentMonths, maxCommitmentMonths };

export const commitmentPeriodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const periodSchema = commitmentPeriodSchema;

export const ListCommitmentsQuerySchema = z
  .object({
    startPeriod: periodSchema.openapi({
      param: { name: "startPeriod", in: "query" },
      example: "2026-10",
    }),
    endPeriod: periodSchema.openapi({
      param: { name: "endPeriod", in: "query" },
      example: "2027-03",
    }),
  })
  .superRefine((query, context) => {
    const months = countCommitmentMonths(query.startPeriod, query.endPeriod);
    if (months < 1) {
      context.addIssue({
        code: "custom",
        path: ["endPeriod"],
        message: "endPeriod must not be before startPeriod",
      });
    } else if (months > maxCommitmentMonths) {
      context.addIssue({
        code: "custom",
        path: ["endPeriod"],
        message: `Period range must not exceed ${maxCommitmentMonths} months`,
      });
    }
  })
  .openapi("ListCommitmentsQuery");

const CommitmentMonthSchema = z.object({
  period: periodSchema,
  installmentsAmount: z.number().nonnegative(),
  recurringAmount: z.number().nonnegative(),
  billsAmount: z.number().nonnegative(),
  creditsAmount: z.number().nonnegative(),
  committedAmount: z.number().nonnegative(),
  incomeAmount: z.number().nonnegative(),
  freeAmount: z.number(),
  commitmentPercentage: z.number().nullable(),
  status: z.enum(commitmentStatuses),
});

const EndingSeriesSchema = z.object({
  seriesId: z.uuid(),
  name: z.string(),
  endPeriod: periodSchema,
  monthlyAmount: z.number().nonnegative(),
  remainingAmount: z.number().nonnegative(),
});

const ReliefSchema = z.object({
  period: periodSchema,
  previousPeriod: periodSchema,
  releasedAmount: z.number().positive(),
  percentage: z.number().positive(),
});

export const CommitmentsOutputSchema = z
  .object({
    period: periodSchema,
    months: z.array(CommitmentMonthSchema),
    endingSeries: z.array(EndingSeriesSchema),
    relief: ReliefSchema.nullable(),
  })
  .openapi("Commitments");

export type ListCommitmentsQuery = z.infer<typeof ListCommitmentsQuerySchema>;
export type CommitmentsOutput = z.infer<typeof CommitmentsOutputSchema>;

import { z } from "@hono/zod-openapi";
import { categoryTrendChangeKinds } from "@openmonetis/domain/category-trends";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const categoryIdsSchema = z
  .string()
  .optional()
  .transform((value, context) => {
    if (!value) return [];
    const categoryIds = [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

    if (categoryIds.length > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected at most 100 category IDs",
      });
      return z.NEVER;
    }

    if (categoryIds.some((categoryId) => !z.uuid().safeParse(categoryId).success)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected a comma-separated UUID list",
      });
      return z.NEVER;
    }

    return categoryIds;
  });

export const ListCategoryTrendsQuerySchema = z
  .object({
    startPeriod: periodSchema.openapi({
      param: { name: "startPeriod", in: "query" },
      example: "2026-01",
    }),
    endPeriod: periodSchema.openapi({
      param: { name: "endPeriod", in: "query" },
      example: "2026-06",
    }),
    categoryIds: categoryIdsSchema,
    personScope: z.union([z.enum(["admin", "all"]), z.uuid()]).optional(),
  })
  .superRefine((query, context) => {
    const startIndex = toPeriodIndex(query.startPeriod);
    const endIndex = toPeriodIndex(query.endPeriod);
    if (endIndex < startIndex) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endPeriod"],
        message: "endPeriod must not be before startPeriod",
      });
      return;
    }
    if (endIndex - startIndex + 1 > 24) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endPeriod"],
        message: "Period range must not exceed 24 months",
      });
    }
  })
  .openapi("ListCategoryTrendsQuery");

export const CategoryTrendPeriodOutputSchema = z
  .object({
    period: periodSchema,
    incomeAmount: z.number().nonnegative(),
    expenseAmount: z.number().nonnegative(),
    netAmount: z.number(),
    actualAmount: z.number().nonnegative(),
    recurringAmount: z.number().nonnegative(),
  })
  .openapi("CategoryTrendPeriod");

export const CategoryTrendValueOutputSchema = z
  .object({
    period: periodSchema,
    actualAmount: z.number().nonnegative(),
    recurringAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    previousAmount: z.number().nonnegative(),
    changeAmount: z.number(),
    changePercentage: z.number().nullable(),
    changeKind: z.enum(categoryTrendChangeKinds),
  })
  .openapi("CategoryTrendValue");

export const CategoryTrendAvailableCategoryOutputSchema = z
  .object({
    categoryId: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    type: z.enum(["income", "expense"]),
  })
  .openapi("CategoryTrendAvailableCategory");

export const CategoryTrendCategoryOutputSchema = CategoryTrendAvailableCategoryOutputSchema.extend({
  totalAmount: z.number().nonnegative(),
  averageAmount: z.number().nonnegative(),
  values: z.array(CategoryTrendValueOutputSchema),
}).openapi("CategoryTrendCategory");

export const CategoryTrendsSummaryOutputSchema = z
  .object({
    periodCount: z.number().int().min(1).max(24),
    categoryCount: z.number().int().nonnegative(),
    incomeAmount: z.number().nonnegative(),
    expenseAmount: z.number().nonnegative(),
    netAmount: z.number(),
    actualAmount: z.number().nonnegative(),
    recurringAmount: z.number().nonnegative(),
    totalAmount: z.number().nonnegative(),
    averageMonthlyIncomeAmount: z.number().nonnegative(),
    averageMonthlyExpenseAmount: z.number().nonnegative(),
    averageMonthlyNetAmount: z.number(),
  })
  .openapi("CategoryTrendsSummary");

export const CategoryTrendsOutputSchema = z
  .object({
    periods: z.array(CategoryTrendPeriodOutputSchema),
    categories: z.array(CategoryTrendCategoryOutputSchema),
    availableCategories: z.array(CategoryTrendAvailableCategoryOutputSchema),
    summary: CategoryTrendsSummaryOutputSchema,
  })
  .openapi("CategoryTrends");

export type ListCategoryTrendsQuery = z.infer<typeof ListCategoryTrendsQuerySchema>;
export type CategoryTrendsOutput = z.infer<typeof CategoryTrendsOutputSchema>;

function toPeriodIndex(period: string) {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + month - 1;
}

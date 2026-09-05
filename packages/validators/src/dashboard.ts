import { z } from "@hono/zod-openapi";
import { accountTypes } from "@openmonetis/domain/accounts";
import { dashboardWidgetIds } from "@openmonetis/domain/dashboard";
import { paymentMethods, transactionConditions } from "@openmonetis/domain/transactions";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const metricPairSchema = z.object({
  current: z.number().finite(),
  hasPreviousData: z.boolean(),
  previous: z.number().finite(),
});
const dashboardHistoryEntrySchema = z.object({
  period: periodSchema,
  income: z.number().finite().nonnegative(),
  expenses: z.number().finite().nonnegative(),
  balance: z.number().finite(),
});

export const DashboardQuerySchema = z
  .object({
    period: periodSchema.openapi({
      param: { name: "period", in: "query" },
      example: "2026-07",
    }),
  })
  .openapi("DashboardQuery");

export const DashboardWidgetIdSchema = z.enum(dashboardWidgetIds);

export const DashboardWidgetPreferencesInputSchema = z
  .object({
    order: z.array(DashboardWidgetIdSchema).max(dashboardWidgetIds.length),
    hidden: z.array(DashboardWidgetIdSchema).max(dashboardWidgetIds.length),
  })
  .strict()
  .superRefine((preferences, context) => {
    for (const [field, values] of Object.entries(preferences)) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: `${field} must not contain duplicate widget IDs`,
          path: [field],
        });
      }
    }
  })
  .openapi("DashboardWidgetPreferencesInput");

export const DashboardWidgetPreferencesOutputSchema = z
  .object({
    order: z.array(DashboardWidgetIdSchema).length(dashboardWidgetIds.length),
    hidden: z.array(DashboardWidgetIdSchema).max(dashboardWidgetIds.length),
  })
  .openapi("DashboardWidgetPreferences");

export const DashboardMetricsOutputSchema = z
  .object({
    period: periodSchema,
    previousPeriod: periodSchema,
    income: metricPairSchema,
    expenses: metricPairSchema,
    balance: metricPairSchema,
    projected: metricPairSchema,
    history: z.array(dashboardHistoryEntrySchema).length(6),
  })
  .openapi("DashboardMetrics");

const dashboardPaymentStatusCategorySchema = z.object({
  total: z.number().finite().nonnegative(),
  confirmed: z.number().finite().nonnegative(),
  pending: z.number().finite().nonnegative(),
});

export const DashboardPaymentStatusOutputSchema = z
  .object({
    period: periodSchema,
    income: dashboardPaymentStatusCategorySchema,
    expenses: dashboardPaymentStatusCategorySchema,
  })
  .openapi("DashboardPaymentStatus");

const expenseDistributionItemSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z.object({
    key: z.enum(values),
    amount: z.number().finite().nonnegative(),
    count: z.number().int().nonnegative(),
    percentage: z.number().finite().min(0).max(100),
  });

export const DashboardExpenseDistributionOutputSchema = z
  .object({
    period: periodSchema,
    totalAmount: z.number().finite().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    conditions: z.array(expenseDistributionItemSchema(transactionConditions)),
    paymentMethods: z.array(expenseDistributionItemSchema(paymentMethods)),
  })
  .openapi("DashboardExpenseDistribution");

const dashboardCategoryBreakdownItemSchema = z.object({
  categoryId: z.uuid(),
  categoryName: z.string(),
  categoryIcon: z.string().nullable(),
  amount: z.number().finite().nonnegative(),
  previousAmount: z.number().finite().nonnegative(),
  count: z.number().int().nonnegative(),
  percentage: z.number().finite().min(0).max(100),
});

export const DashboardCategoryBreakdownOutputSchema = z
  .object({
    period: periodSchema,
    previousPeriod: periodSchema,
    incomeTotal: z.number().finite().nonnegative(),
    expensesTotal: z.number().finite().nonnegative(),
    income: z.array(dashboardCategoryBreakdownItemSchema),
    expenses: z.array(dashboardCategoryBreakdownItemSchema),
  })
  .openapi("DashboardCategoryBreakdown");

const dashboardPersonExpenseItemSchema = z.object({
  personId: z.uuid(),
  personName: z.string(),
  personAvatarUrl: z.string().nullable(),
  personRole: z.enum(["admin", "external"]),
  personStatus: z.enum(["active", "inactive"]),
  amount: z.number().finite().nonnegative(),
  previousAmount: z.number().finite().nonnegative(),
  count: z.number().int().nonnegative(),
  percentage: z.number().finite().min(0).max(100),
});

export const DashboardPeopleExpensesOutputSchema = z
  .object({
    period: periodSchema,
    previousPeriod: periodSchema,
    totalAmount: z.number().finite().nonnegative(),
    items: z.array(dashboardPersonExpenseItemSchema),
  })
  .openapi("DashboardPeopleExpenses");

export const DashboardAccountOutputSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(accountTypes),
    logo: z.string().nullable(),
    balance: z.number().finite(),
    excludeFromBalance: z.boolean(),
  })
  .openapi("DashboardAccount");

export const DashboardAccountsOutputSchema = z
  .object({
    period: periodSchema,
    scope: z.object({
      accountingBasis: z.literal("cash"),
      includePending: z.literal(false),
      personScope: z.literal("primary"),
    }),
    totalBalance: z.number().finite(),
    items: z.array(DashboardAccountOutputSchema),
  })
  .openapi("DashboardAccounts");

export const DashboardSnapshotOutputSchema = z
  .object({
    metrics: DashboardMetricsOutputSchema,
    accounts: DashboardAccountsOutputSchema,
    paymentStatus: DashboardPaymentStatusOutputSchema,
    expenseDistribution: DashboardExpenseDistributionOutputSchema,
    categoryBreakdown: DashboardCategoryBreakdownOutputSchema,
    peopleExpenses: DashboardPeopleExpensesOutputSchema,
  })
  .openapi("DashboardSnapshot");

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type DashboardWidgetPreferencesInput = z.infer<typeof DashboardWidgetPreferencesInputSchema>;
export type DashboardWidgetPreferencesOutput = z.infer<
  typeof DashboardWidgetPreferencesOutputSchema
>;
export type DashboardMetricsOutput = z.infer<typeof DashboardMetricsOutputSchema>;
export type DashboardPaymentStatusOutput = z.infer<typeof DashboardPaymentStatusOutputSchema>;
export type DashboardExpenseDistributionOutput = z.infer<
  typeof DashboardExpenseDistributionOutputSchema
>;
export type DashboardCategoryBreakdownOutput = z.infer<
  typeof DashboardCategoryBreakdownOutputSchema
>;
export type DashboardPeopleExpensesOutput = z.infer<typeof DashboardPeopleExpensesOutputSchema>;
export type DashboardAccountOutput = z.infer<typeof DashboardAccountOutputSchema>;
export type DashboardAccountsOutput = z.infer<typeof DashboardAccountsOutputSchema>;
export type DashboardSnapshotOutput = z.infer<typeof DashboardSnapshotOutputSchema>;

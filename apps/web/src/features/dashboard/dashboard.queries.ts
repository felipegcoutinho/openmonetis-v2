import { queryOptions } from "@tanstack/react-query";
import { getDashboardSnapshot, getDashboardWidgetPreferences } from "./dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  snapshot: (period: string) => [...dashboardKeys.all, "snapshot", period] as const,
  metrics: (period: string) => [...dashboardKeys.all, "metrics", period] as const,
  accounts: (period: string) => [...dashboardKeys.all, "accounts", period] as const,
  paymentStatus: (period: string) => [...dashboardKeys.all, "payment-status", period] as const,
  expenseDistribution: (period: string) =>
    [...dashboardKeys.all, "expense-distribution", period] as const,
  categoryBreakdown: (period: string) =>
    [...dashboardKeys.all, "category-breakdown", period] as const,
  peopleExpenses: (period: string) => [...dashboardKeys.all, "people-expenses", period] as const,
  preferences: () => [...dashboardKeys.all, "preferences"] as const,
};

export function dashboardMetricsQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.metrics,
  });
}

export function dashboardAccountsQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.accounts,
  });
}

export function dashboardPaymentStatusQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.paymentStatus,
  });
}

export function dashboardExpenseDistributionQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.expenseDistribution,
  });
}

export function dashboardCategoryBreakdownQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.categoryBreakdown,
  });
}

export function dashboardPeopleExpensesQueryOptions(period: string) {
  return queryOptions({
    queryKey: dashboardKeys.snapshot(period),
    queryFn: () => getDashboardSnapshot(period),
    select: (snapshot) => snapshot.peopleExpenses,
  });
}

export function dashboardWidgetPreferencesQueryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.preferences(),
    queryFn: getDashboardWidgetPreferences,
  });
}

import { queryOptions } from "@tanstack/react-query";
import { getBudgets } from "./budgets.api";

const budgetKeys = {
  all: ["budgets"] as const,
  list: (period: string) => [...budgetKeys.all, period] as const,
};

export function budgetsQueryOptions(period: string) {
  return queryOptions({ queryKey: budgetKeys.list(period), queryFn: () => getBudgets(period) });
}

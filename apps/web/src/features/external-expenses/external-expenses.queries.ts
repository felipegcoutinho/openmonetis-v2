import { queryOptions } from "@tanstack/react-query";
import { getExternalExpenses } from "./external-expenses.api";

export const externalExpenseKeys = {
  all: ["external-expenses"] as const,
  list: (view: "pending" | "imported", period: string | undefined, page: number) =>
    ["external-expenses", "list", view, period ?? "all", page] as const,
};

export const externalExpensesQueryOptions = (input: {
  view: "pending" | "imported";
  period?: string;
  page?: number;
}) =>
  queryOptions({
    queryKey: externalExpenseKeys.list(input.view, input.period, input.page ?? 1),
    queryFn: () => getExternalExpenses(input),
  });

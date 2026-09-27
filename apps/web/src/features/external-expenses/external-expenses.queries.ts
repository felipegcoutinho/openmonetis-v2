import { queryOptions } from "@tanstack/react-query";
import { type ExternalExpensesListInput, getExternalExpenses } from "./external-expenses.api";

export const externalExpenseKeys = {
  all: ["external-expenses"] as const,
  list: (input: ExternalExpensesListInput) =>
    [
      "external-expenses",
      "list",
      input.view,
      input.period ?? "all",
      input.q ?? "",
      input.sort ?? "recent",
      input.page ?? 1,
    ] as const,
};

export const externalExpensesQueryOptions = (input: ExternalExpensesListInput) =>
  queryOptions({
    queryKey: externalExpenseKeys.list(input),
    queryFn: () => getExternalExpenses(input),
  });

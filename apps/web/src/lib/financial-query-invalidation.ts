import type { QueryClient } from "@tanstack/react-query";

const financialQueryRoots = new Set([
  "accounts",
  "attachments",
  "bills",
  "budgets",
  "cards",
  "categories",
  "category-trends",
  "dashboard",
  "installments",
  "inbox",
  "invoices",
  "notifications",
  "people",
  "person-settlements",
  "recurring-expenses",
  "external-expenses",
  "transactions",
]);

export function refreshFinancialQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => financialQueryRoots.has(String(query.queryKey[0])),
    refetchType: "active",
  });
}

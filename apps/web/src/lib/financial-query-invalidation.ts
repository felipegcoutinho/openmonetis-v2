import type { QueryClient } from "@tanstack/react-query";

const financialQueryRoots = new Set([
  "accounts",
  "attachments",
  "bills",
  "budgets",
  "cards",
  "categories",
  "tags",
  "category-trends",
  "commitments",
  "financial-distribution",
  "dashboard",
  "due-date-rules",
  "installments",
  "inbox",
  "invoices",
  "notifications",
  "people",
  "person-reports",
  "person-settlements",
  "recurring-expenses",
  "recurring-transactions",
  "external-expenses",
  "goals",
  "transactions",
]);

export function refreshFinancialQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => financialQueryRoots.has(String(query.queryKey[0])),
    refetchType: "active",
  });
}

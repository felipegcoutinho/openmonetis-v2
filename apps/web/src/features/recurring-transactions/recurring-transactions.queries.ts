import { queryOptions } from "@tanstack/react-query";
import {
  getRecurringTransactionOccurrence,
  getRecurringTransactionsReport,
} from "./recurring-transactions.api";

export function recurringTransactionsReportQueryOptions(type: "income" | "expense") {
  return queryOptions({
    queryKey: ["recurring-transactions", "report", type],
    queryFn: () => getRecurringTransactionsReport(type),
  });
}
export function recurringTransactionOccurrenceQueryOptions(id: string, date: string) {
  return queryOptions({
    queryKey: ["recurring-transactions", "occurrence", id, date],
    queryFn: () => getRecurringTransactionOccurrence(id, date),
  });
}

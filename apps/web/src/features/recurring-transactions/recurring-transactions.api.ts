import type { RecurringTransactionsReportOutput } from "@openmonetis/validators/recurring-transactions";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { requestApi } from "@/lib/api-client";

export function getRecurringTransactionsReport(type: "income" | "expense") {
  return requestApi<RecurringTransactionsReportOutput>(
    `/recurring-transactions/report?${new URLSearchParams({ type })}`,
  );
}

export function getRecurringTransactionOccurrence(id: string, occurrenceDate: string) {
  return requestApi<TransactionOutput>(
    `/transactions/recurring-rules/${id}/occurrence?${new URLSearchParams({ occurrenceDate })}`,
  );
}

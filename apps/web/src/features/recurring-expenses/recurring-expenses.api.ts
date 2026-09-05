import type {
  RecurringExpensesOutput,
  RecurringExpensesReportOutput,
  UpdateRecurringExpenseInput,
} from "@openmonetis/validators/recurring-expenses";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "Recurring expense request failed" });
}

export function getRecurringExpenses(period: string) {
  return request<RecurringExpensesOutput>(
    `/recurring-expenses?${new URLSearchParams({ period }).toString()}`,
  );
}

export function getRecurringExpensesReport(period: string) {
  return request<RecurringExpensesReportOutput>(
    `/recurring-expenses/report?${new URLSearchParams({ period }).toString()}`,
  );
}

export function updateRecurringExpense(
  id: string,
  purchaseDate: string,
  input: UpdateRecurringExpenseInput,
) {
  return request<{ success: true }>(`/recurring-expenses/${id}/occurrences/${purchaseDate}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function changeRecurringExpenseState(
  action: "pause" | "resume" | "skip" | "stop",
  id: string,
  purchaseDate: string,
) {
  return request<{ success: true }>(
    `/recurring-expenses/${id}/occurrences/${purchaseDate}/${action}`,
    { method: "POST" },
  );
}

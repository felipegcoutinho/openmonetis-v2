import type {
  ExternalExpenseOutput,
  ExternalExpensePageOutput,
  ImportExternalExpenseOutput,
  ListExternalExpensesQuery,
} from "@openmonetis/validators/external-expenses";
import type { TransactionInput } from "@openmonetis/validators/transactions";
import { requestApi as request } from "@/lib/api-client";

export type ExternalExpensesListInput = {
  view: "pending" | "imported" | "ignored";
  period?: string;
  page?: number;
  q?: string;
  sort?: ListExternalExpensesQuery["sort"];
};

export function getExternalExpenses(input: ExternalExpensesListInput) {
  const query = new URLSearchParams({
    view: input.view,
    page: String(input.page ?? 1),
    pageSize: "50",
  });
  if (input.period) query.set("period", input.period);
  if (input.q) query.set("q", input.q);
  if (input.sort) query.set("sort", input.sort);
  return request<ExternalExpensePageOutput>(`/external-expenses?${query.toString()}`);
}

export const importExternalExpense = (input: {
  id: string;
  expectedVersion: number;
  transaction: TransactionInput;
}) =>
  request<ImportExternalExpenseOutput>(`/external-expenses/${input.id}/import`, {
    method: "POST",
    body: JSON.stringify({
      expectedVersion: input.expectedVersion,
      transaction: input.transaction,
    }),
  });

export const reviewExternalExpense = (input: {
  id: string;
  expectedVersion: number;
  action: "ignore" | "restore";
}) =>
  request<ExternalExpenseOutput>(`/external-expenses/${input.id}/${input.action}`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: input.expectedVersion }),
  });

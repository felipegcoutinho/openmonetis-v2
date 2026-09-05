import type {
  ExternalExpensePageOutput,
  ImportExternalExpenseOutput,
} from "@openmonetis/validators/external-expenses";
import type { TransactionInput } from "@openmonetis/validators/transactions";
import { requestApi as request } from "@/lib/api-client";

export function getExternalExpenses(input: {
  view: "pending" | "imported";
  period?: string;
  page?: number;
}) {
  const query = new URLSearchParams({
    view: input.view,
    page: String(input.page ?? 1),
    pageSize: "50",
  });
  if (input.period) query.set("period", input.period);
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

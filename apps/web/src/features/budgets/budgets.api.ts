import type {
  BudgetOutput,
  BudgetOverviewOutput,
  CopyPreviousBudgetsInput,
  CopyPreviousBudgetsOutput,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@openmonetis/validators/budgets";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { useResponseMessage: true });
}

export function getBudgets(period: string) {
  return request<BudgetOverviewOutput>(`/budgets?${new URLSearchParams({ period })}`);
}

export function createBudget(input: CreateBudgetInput) {
  return request<BudgetOutput>("/budgets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBudget(id: string, input: UpdateBudgetInput) {
  return request<BudgetOutput>(`/budgets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBudget(id: string) {
  return request<{ id: string }>(`/budgets/${id}`, { method: "DELETE" });
}

export function copyPreviousBudgets(input: CopyPreviousBudgetsInput) {
  return request<CopyPreviousBudgetsOutput>("/budgets/copy-previous", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

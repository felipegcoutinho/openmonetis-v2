import type {
  BudgetOutput,
  BudgetOverviewOutput,
  CopyPreviousBudgetsInput,
  CopyPreviousBudgetsOutput,
  CreateBudgetInput,
  StopBudgetRuleInput,
  StoppedBudgetRuleOutput,
  UpdateBudgetInput,
  UpdateBudgetRuleInput,
} from "@openmonetis/validators/budgets";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

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

export function repeatBudget(id: string) {
  return request<BudgetOutput>(`/budgets/${id}/repeat`, { method: "POST" });
}

export function updateBudgetRule(ruleId: string, input: UpdateBudgetRuleInput) {
  return request<BudgetOutput>(`/budgets/recurring-rules/${ruleId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function stopBudgetRule(ruleId: string, input: StopBudgetRuleInput) {
  return request<StoppedBudgetRuleOutput>(`/budgets/recurring-rules/${ruleId}/stop`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

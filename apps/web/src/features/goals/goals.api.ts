import type {
  CreatedGoalContributionOutput,
  CreateGoalContributionInput,
  CreateGoalInput,
  GoalContributionsOutput,
  GoalOutput,
  RemovedGoalContributionOutput,
  UpdateGoalInput,
} from "@openmonetis/validators/goals";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

export function getGoals() {
  return request<GoalOutput[]>("/goals");
}

export function createGoal(input: CreateGoalInput) {
  return request<GoalOutput>("/goals", { method: "POST", body: JSON.stringify(input) });
}

export function updateGoal(id: string, input: UpdateGoalInput) {
  return request<GoalOutput>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteGoal(id: string) {
  return request<{ id: string }>(`/goals/${id}`, { method: "DELETE" });
}

export function getGoalContributions(id: string) {
  return request<GoalContributionsOutput>(`/goals/${id}/contributions`);
}

export function createGoalContribution(id: string, input: CreateGoalContributionInput) {
  return request<CreatedGoalContributionOutput>(`/goals/${id}/contributions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteGoalContribution(id: string, contributionId: string) {
  return request<RemovedGoalContributionOutput>(`/goals/${id}/contributions/${contributionId}`, {
    method: "DELETE",
  });
}

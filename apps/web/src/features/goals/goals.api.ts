import type { CreateGoalInput, GoalOutput, UpdateGoalInput } from "@openmonetis/validators/goals";
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

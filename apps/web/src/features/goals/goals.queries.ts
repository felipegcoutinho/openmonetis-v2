import { queryOptions } from "@tanstack/react-query";
import { getGoalContributions, getGoals } from "./goals.api";

export const goalKeys = {
  all: ["goals"] as const,
  contributions: (id: string) => [...goalKeys.all, id, "contributions"] as const,
};

export function goalsQueryOptions() {
  return queryOptions({ queryKey: goalKeys.all, queryFn: getGoals });
}

export function goalContributionsQueryOptions(id: string) {
  return queryOptions({
    queryKey: goalKeys.contributions(id),
    queryFn: () => getGoalContributions(id),
  });
}

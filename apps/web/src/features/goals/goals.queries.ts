import { queryOptions } from "@tanstack/react-query";
import { getGoals } from "./goals.api";

export function goalsQueryOptions() {
  return queryOptions({ queryKey: ["goals"], queryFn: getGoals });
}

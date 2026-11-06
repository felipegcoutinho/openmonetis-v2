import { queryOptions } from "@tanstack/react-query";
import { getAiToolEvents, getAiTools } from "./ai-tools.api";

const installCheckIntervalMs = 3_000;

export const aiToolKeys = {
  all: ["ai-tools"] as const,
  events: () => [...aiToolKeys.all, "events"] as const,
};

/** Polls while an install runs, so its steps and result show up without reloading. */
export function aiToolsQueryOptions() {
  return queryOptions({
    queryKey: aiToolKeys.all,
    queryFn: ({ signal }) => getAiTools(signal),
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => item.job?.status === "pending")
        ? installCheckIntervalMs
        : false,
  });
}

/** Read only while the history is open; mutations refresh it through `aiToolKeys.all`. */
export function aiToolEventsQueryOptions() {
  return queryOptions({
    queryKey: aiToolKeys.events(),
    queryFn: ({ signal }) => getAiToolEvents(signal),
  });
}

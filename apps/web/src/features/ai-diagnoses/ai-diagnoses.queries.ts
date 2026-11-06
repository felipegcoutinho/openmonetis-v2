import { queryOptions } from "@tanstack/react-query";
import { getAiDiagnoses, getAiDiagnosis } from "./ai-diagnoses.api";

const pendingCheckIntervalMs = 3_000;

export const aiDiagnosisKeys = {
  all: ["ai-diagnoses"] as const,
  list: () => [...aiDiagnosisKeys.all, "list"] as const,
  detail: (id: string) => [...aiDiagnosisKeys.all, "detail", id] as const,
};

export function aiDiagnosesQueryOptions() {
  return queryOptions({
    queryKey: aiDiagnosisKeys.list(),
    queryFn: ({ signal }) => getAiDiagnoses(signal),
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => item.status === "pending")
        ? pendingCheckIntervalMs
        : false,
  });
}

/** Polls a diagnosis while the provider is still writing it. */
export function aiDiagnosisQueryOptions(id: string) {
  return queryOptions({
    queryKey: aiDiagnosisKeys.detail(id),
    queryFn: ({ signal }) => getAiDiagnosis(id, signal),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? pendingCheckIntervalMs : false,
  });
}

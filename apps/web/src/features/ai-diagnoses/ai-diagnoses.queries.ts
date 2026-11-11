import type { AiDiagnosesOutput } from "@openmonetis/validators/ai-diagnoses";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { aiProvidersQueryOptions } from "@/features/ai-providers/ai-providers.queries";
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

/** The diagnosis the page opens: the one in the address, else the latest one of the month. */
export function selectAiDiagnosisId(
  items: AiDiagnosesOutput["items"] | undefined,
  period: string,
  diagnosisId?: string,
) {
  return diagnosisId ?? items?.find((item) => item.period === period)?.id;
}

/**
 * Starts the page's reads before it renders (also on link hover), so the report does not wait
 * for the list to arrive first. Best effort: the page's own queries show any failure.
 */
export async function prefetchAiDiagnosesPage(
  client: QueryClient,
  { period, diagnosisId }: { period: string; diagnosisId?: string },
) {
  void client.prefetchQuery(aiProvidersQueryOptions());
  if (diagnosisId) {
    void client.prefetchQuery(aiDiagnosisQueryOptions(diagnosisId));
    return;
  }
  try {
    const list = await client.ensureQueryData(aiDiagnosesQueryOptions());
    const id = selectAiDiagnosisId(list.items, period);
    if (id) void client.prefetchQuery(aiDiagnosisQueryOptions(id));
  } catch {
    // Signed out or offline: the page handles it when it renders.
  }
}

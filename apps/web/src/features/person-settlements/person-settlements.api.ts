import type {
  CreatePersonSettlementInput,
  PersonSettlementOutput,
  PersonSettlementSnapshotOutput,
  PersonSettlementsSummaryOutput,
} from "@openmonetis/validators/person-settlements";
import { requestApi } from "@/lib/api-client";

export function getPersonSettlementSnapshot(personId: string, period: string) {
  const query = new URLSearchParams({ period });
  return requestApi<PersonSettlementSnapshotOutput>(
    `/person-settlements/people/${personId}?${query.toString()}`,
  );
}

export function getPersonSettlementsSummary(period: string) {
  const query = new URLSearchParams({ period });
  return requestApi<PersonSettlementsSummaryOutput>(`/person-settlements?${query.toString()}`);
}

export function createPersonSettlement(input: CreatePersonSettlementInput) {
  return requestApi<PersonSettlementOutput>("/person-settlements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deletePersonSettlement(id: string) {
  return requestApi<{ id: string }>(`/person-settlements/${id}`, { method: "DELETE" });
}

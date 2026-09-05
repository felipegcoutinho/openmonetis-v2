import { queryOptions } from "@tanstack/react-query";
import { getPersonSettlementSnapshot, getPersonSettlementsSummary } from "./person-settlements.api";

export const personSettlementKeys = {
  all: ["person-settlements"] as const,
  detail: (personId: string, period: string) =>
    ["person-settlements", "person", personId, period] as const,
  summary: (period: string) => ["person-settlements", "summary", period] as const,
};

export const personSettlementsSummaryQueryOptions = (period: string) =>
  queryOptions({
    queryKey: personSettlementKeys.summary(period),
    queryFn: () => getPersonSettlementsSummary(period),
  });

export const personSettlementQueryOptions = (personId: string, period: string) =>
  queryOptions({
    queryKey: personSettlementKeys.detail(personId, period),
    queryFn: () => getPersonSettlementSnapshot(personId, period),
  });

import { queryOptions } from "@tanstack/react-query";
import { getPeople, getPerson, getPersonFinancialSummary } from "./people.api";
export const personKeys = {
  all: ["people"] as const,
  detail: (id: string) => ["people", id] as const,
  summary: (id: string, period: string) => ["people", id, "summary", period] as const,
};
export const peopleQueryOptions = () =>
  queryOptions({ queryKey: personKeys.all, queryFn: getPeople });
export const personQueryOptions = (id: string) =>
  queryOptions({ queryKey: personKeys.detail(id), queryFn: () => getPerson(id) });
export const personFinancialSummaryQueryOptions = (id: string, period: string) =>
  queryOptions({
    queryKey: personKeys.summary(id, period),
    queryFn: () => getPersonFinancialSummary(id, period),
  });

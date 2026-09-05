import type {
  ListInstallmentsQuery,
  QuoteInstallmentsInput,
} from "@openmonetis/validators/installments";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getDashboardInstallmentExpenses,
  getInstallmentAnticipation,
  getInstallments,
  quoteInstallments,
} from "./installments.api";

const installmentKeys = {
  all: ["installments"] as const,
  dashboard: (period: string) => [...installmentKeys.all, "dashboard", period] as const,
  report: (query: ListInstallmentsQuery) =>
    [...installmentKeys.all, query.period, query.status, query.q ?? ""] as const,
  quote: (installmentIds: string[]) =>
    [...installmentKeys.all, "anticipation-quote", ...installmentIds] as const,
  anticipation: (seriesId: string, anticipationId: string) =>
    [...installmentKeys.all, "anticipation", seriesId, anticipationId] as const,
};

export function dashboardInstallmentExpensesQueryOptions(period: string) {
  return queryOptions({
    queryKey: installmentKeys.dashboard(period),
    queryFn: () => getDashboardInstallmentExpenses(period),
  });
}

export function installmentQuoteQueryOptions(input: QuoteInstallmentsInput) {
  return queryOptions({
    queryKey: installmentKeys.quote(input.installmentIds),
    queryFn: () => quoteInstallments(input),
  });
}

export function installmentAnticipationQueryOptions(seriesId: string, anticipationId: string) {
  return queryOptions({
    queryKey: installmentKeys.anticipation(seriesId, anticipationId),
    queryFn: () => getInstallmentAnticipation(seriesId, anticipationId),
  });
}

export function installmentsQueryOptions(query: ListInstallmentsQuery) {
  return queryOptions({
    queryKey: installmentKeys.report(query),
    queryFn: () => getInstallments(query),
    placeholderData: keepPreviousData,
  });
}

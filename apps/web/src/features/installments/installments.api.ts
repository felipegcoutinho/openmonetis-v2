import type {
  CreateInstallmentAnticipationInput,
  DashboardInstallmentExpensesOutput,
  InstallmentAnticipationDetailsOutput,
  InstallmentAnticipationOutput,
  InstallmentQuoteOutput,
  InstallmentsReportOutput,
  ListInstallmentsQuery,
  QuoteInstallmentsInput,
  UndoInstallmentAnticipationInput,
  UndoInstallmentAnticipationOutput,
} from "@openmonetis/validators/installments";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

export function getInstallments(query: ListInstallmentsQuery) {
  const params = new URLSearchParams({ period: query.period, status: query.status });
  if (query.q) params.set("q", query.q);
  return request<InstallmentsReportOutput>(`/reports/installments?${params.toString()}`);
}

export function getDashboardInstallmentExpenses(period: string) {
  const params = new URLSearchParams({ period });
  return request<DashboardInstallmentExpensesOutput>(
    `/reports/installments/dashboard?${params.toString()}`,
  );
}

export function quoteInstallments(input: QuoteInstallmentsInput) {
  return request<InstallmentQuoteOutput>("/reports/installments/quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function anticipateInstallments(
  seriesId: string,
  input: CreateInstallmentAnticipationInput,
) {
  return request<InstallmentAnticipationOutput>(`/reports/installments/${seriesId}/anticipations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getInstallmentAnticipation(seriesId: string, anticipationId: string) {
  return request<InstallmentAnticipationDetailsOutput>(
    `/reports/installments/${seriesId}/anticipations/${anticipationId}`,
  );
}

export function undoInstallmentAnticipation(
  seriesId: string,
  anticipationId: string,
  input: UndoInstallmentAnticipationInput,
) {
  return request<UndoInstallmentAnticipationOutput>(
    `/reports/installments/${seriesId}/anticipations/${anticipationId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

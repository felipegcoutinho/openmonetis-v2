import type {
  CreateInstallmentAnticipationInput,
  DashboardInstallmentExpensesOutput,
  InstallmentAnticipationDetailsOutput,
  InstallmentAnticipationOutput,
  InstallmentPayoffSimulationOutput,
  InstallmentPurchaseSimulationOutput,
  InstallmentQuoteOutput,
  InstallmentsReportOutput,
  ListInstallmentsQuery,
  QuoteInstallmentsInput,
  SimulateInstallmentPayoffInput,
  SimulateInstallmentPurchaseInput,
  UndoInstallmentAnticipationInput,
  UndoInstallmentAnticipationOutput,
} from "@openmonetis/validators/installments";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

export function getInstallments(query: ListInstallmentsQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  const queryString = params.toString();
  return request<InstallmentsReportOutput>(
    `/reports/installments${queryString ? `?${queryString}` : ""}`,
  );
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

/** Computes a hypothetical purchase on the server; nothing is saved. */
export function simulateInstallmentPurchase(input: SimulateInstallmentPurchaseInput) {
  return request<InstallmentPurchaseSimulationOutput>("/reports/installments/simulations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Computes an early payoff on the server; nothing is saved. */
export function simulateInstallmentPayoff(input: SimulateInstallmentPayoffInput) {
  return request<InstallmentPayoffSimulationOutput>("/reports/installments/payoff-simulations", {
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

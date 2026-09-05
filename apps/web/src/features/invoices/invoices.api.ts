import type {
  AdjustInvoiceInput,
  CreateInvoicePaymentInput,
  DashboardInvoicesOutput,
  InvoiceAdjustmentOutput,
  InvoicePaymentOutput,
  UndoInvoicePaymentOutput,
  UpdateInvoiceDatesInput,
} from "@openmonetis/validators/invoices";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class InvoicesApiError extends ApiClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "InvoicesApiError";
  }
}

async function request<T>(path: string, init?: RequestInit) {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message }) => new InvoicesApiError(message, code),
    useResponseMessage: true,
  });
}
export function getInvoices(period: string) {
  return request<DashboardInvoicesOutput>(`/invoices?period=${encodeURIComponent(period)}`);
}
export function payInvoice(cardId: string, period: string, input: CreateInvoicePaymentInput) {
  return request<InvoicePaymentOutput>(`/invoices/${cardId}/${period}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export function undoInvoicePayment(cardId: string, period: string, paymentId: string) {
  return request<UndoInvoicePaymentOutput>(`/invoices/${cardId}/${period}/payments/${paymentId}`, {
    method: "DELETE",
  });
}
export function updateInvoiceDates(cardId: string, period: string, input: UpdateInvoiceDatesInput) {
  return request<UpdateInvoiceDatesInput>(`/invoices/${cardId}/${period}/dates`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
export function adjustInvoice(cardId: string, period: string, input: AdjustInvoiceInput) {
  return request<InvoiceAdjustmentOutput>(`/invoices/${cardId}/${period}/adjustments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

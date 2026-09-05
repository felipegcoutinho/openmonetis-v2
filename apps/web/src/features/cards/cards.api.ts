import type {
  CardInvoicePeriodOutput,
  CardOutput,
  CreateCardInput,
  ReplaceCardInput,
  UpdateCardInput,
} from "@openmonetis/validators/cards";
import { requestApi as request } from "@/lib/api-client";

export function getCards(period: string) {
  return request<CardOutput[]>(`/cards?period=${encodeURIComponent(period)}`);
}

export function getCard(id: string, period: string) {
  return request<CardOutput>(`/cards/${id}?period=${encodeURIComponent(period)}`);
}

export function getCardInvoicePeriod(id: string, purchaseDate: string) {
  return request<CardInvoicePeriodOutput>(
    `/cards/${id}/invoice-period?purchaseDate=${encodeURIComponent(purchaseDate)}`,
  );
}

export function createCard(input: CreateCardInput) {
  return request<CardOutput>("/cards", { method: "POST", body: JSON.stringify(input) });
}

export function replaceCard(id: string, input: ReplaceCardInput) {
  return request<CardOutput>(`/cards/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function updateCard(id: string, input: UpdateCardInput) {
  return request<CardOutput>(`/cards/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCard(id: string) {
  return request<{ id: string }>(`/cards/${id}`, { method: "DELETE" });
}

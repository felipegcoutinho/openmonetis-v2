import { queryOptions } from "@tanstack/react-query";
import { getCard, getCardInvoiceHistory, getCardInvoicePeriod, getCards } from "./cards.api";
import { getCurrentCardPeriod } from "./cards.presentation";

const cardKeys = {
  all: ["cards"] as const,
  list: (period: string) => ["cards", "list", period] as const,
  detail: (id: string, period: string) => ["cards", "detail", id, period] as const,
  invoiceHistory: (id: string, period: string) => ["cards", "invoice-history", id, period] as const,
  invoicePeriod: (id: string, purchaseDate: string) =>
    ["cards", "invoice-period", id, purchaseDate] as const,
};

export function cardsQueryOptions(period = getCurrentCardPeriod()) {
  return queryOptions({ queryKey: cardKeys.list(period), queryFn: () => getCards(period) });
}

export function cardInvoicePeriodQueryOptions(id: string, purchaseDate: string) {
  return queryOptions({
    queryKey: cardKeys.invoicePeriod(id, purchaseDate),
    queryFn: () => getCardInvoicePeriod(id, purchaseDate),
    enabled: Boolean(id && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)),
  });
}

export function cardQueryOptions(id: string, period = getCurrentCardPeriod()) {
  return queryOptions({
    queryKey: cardKeys.detail(id, period),
    queryFn: () => getCard(id, period),
  });
}

export function cardInvoiceHistoryQueryOptions(id: string, period: string) {
  return queryOptions({
    queryKey: cardKeys.invoiceHistory(id, period),
    queryFn: () => getCardInvoiceHistory(id, period),
  });
}

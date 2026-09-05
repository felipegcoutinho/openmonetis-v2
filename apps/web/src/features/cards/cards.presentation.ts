import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
} from "@openmonetis/shared/date-time";
import type { CardOutput } from "@openmonetis/validators/cards";
import { getLogoLabel } from "@/lib/logo-catalog";

export const cardBrandLabels: Record<CardOutput["brand"], string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  other: "Outra",
};

export const cardBrandOptions = Object.entries(cardBrandLabels).map(([value, label]) => ({
  value: value as CardOutput["brand"],
  label,
}));

export const daysOfMonth = Array.from({ length: 31 }, (_, index) => index + 1);

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function parseCurrencyInput(value: string) {
  const compactValue = value.replace(/[^\d,.-]/g, "");
  const normalized = compactValue.includes(",")
    ? compactValue.replace(/\./g, "").replace(",", ".")
    : compactValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCardLogoDisplayName(logo?: string | null) {
  return getLogoLabel(logo);
}

export const cardInvoiceStatusLabels: Record<CardOutput["invoiceSummary"]["status"], string> = {
  open: "Aberta",
  closed: "Fechada",
  overdue: "Vencida",
  paid: "Paga",
};

export function getCardClosingRuleDescription(
  card: Pick<CardOutput, "closingOffsetDays" | "closingOffsetMode">,
) {
  if (!card.closingOffsetDays || !card.closingOffsetMode) {
    return "O fechamento é calculado com base na data de vencimento.";
  }

  const dayLabel = card.closingOffsetDays === 1 ? "dia" : "dias";
  const modeLabel =
    card.closingOffsetMode === "weekdays"
      ? card.closingOffsetDays === 1
        ? "útil"
        : "úteis"
      : card.closingOffsetDays === 1
        ? "corrido"
        : "corridos";

  return `O fechamento ocorre ${card.closingOffsetDays} ${dayLabel} ${modeLabel} antes do vencimento.`;
}

export function getCurrentCardPeriod() {
  return getCurrentPeriodInBrazil();
}

export function formatInvoiceDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
  }).replace(" de ", " ");
}

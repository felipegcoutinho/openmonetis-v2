import {
  dateOnlyToSafeInstant,
  differenceInCalendarDaysFromTodayInBrazil,
  formatDateInBrazil,
} from "@openmonetis/shared/date-time";
import { formatRecordedPaymentDate } from "@/lib/payment-presentation";

export function invoiceDueLabel(value: string) {
  const days = differenceInCalendarDaysFromTodayInBrazil(value);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days > 1) return `Vence em ${days} dias`;
  if (days === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(days)} dias`;
}

export function invoicePaidLabel(value: string) {
  return formatRecordedPaymentDate(value);
}

export function formatInvoicePaymentOption(amount: number, paidAt: string) {
  const formattedAmount = amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const formattedDate = formatDateInBrazil(dateOnlyToSafeInstant(paidAt), {});

  return `${formattedAmount} · ${formattedDate}`;
}

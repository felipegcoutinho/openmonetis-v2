import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import { formatDueDateLabel, formatRecordedPaymentDate } from "@/lib/payment-presentation";

export function invoiceDueLabel(value: string) {
  return formatDueDateLabel(value);
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

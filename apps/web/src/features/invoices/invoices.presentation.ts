import {
  dateOnlyToSafeInstant,
  differenceInCalendarDaysFromTodayInBrazil,
  formatDateInBrazil,
  formatDateToPartsInBrazil,
} from "@openmonetis/shared/date-time";

export function invoiceDueLabel(value: string) {
  const days = differenceInCalendarDaysFromTodayInBrazil(value);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days > 1) return `Vence em ${days} dias`;
  if (days === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(days)} dias`;
}

export function invoicePaidLabel(value: string) {
  const parts = formatDateToPartsInBrazil(dateOnlyToSafeInstant(value), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const capitalizedMonth = month.charAt(0).toLocaleUpperCase("pt-BR") + month.slice(1);

  return `Pago em ${day} de ${capitalizedMonth} ${year}`;
}

export function formatInvoicePaymentOption(amount: number, paidAt: string) {
  const formattedAmount = amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const formattedDate = formatDateInBrazil(dateOnlyToSafeInstant(paidAt), {});

  return `${formattedAmount} · ${formattedDate}`;
}

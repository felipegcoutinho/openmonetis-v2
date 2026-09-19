import { differenceInCalendarDaysFromTodayInBrazil } from "@openmonetis/shared/date-time";
import { formatRecordedPaymentDate } from "@/lib/payment-presentation";

export function billDueLabel(value: string) {
  const days = differenceInCalendarDaysFromTodayInBrazil(value);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days > 1) return `Vence em ${days} dias`;
  if (days === -1) return "Venceu ontem";
  return `Venceu há ${Math.abs(days)} dias`;
}

export function billPaidLabel(date: string) {
  return formatRecordedPaymentDate(date);
}

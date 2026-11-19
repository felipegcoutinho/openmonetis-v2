import { formatDueDateLabel, formatRecordedPaymentDate } from "@/lib/payment-presentation";

export function billDueLabel(value: string) {
  return formatDueDateLabel(value);
}

export function billPaidLabel(date: string) {
  return formatRecordedPaymentDate(date);
}

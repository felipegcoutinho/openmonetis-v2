import { listRecurrenceDatesInPeriod, type RecurrenceFrequency } from "./transactions";

export const billStatuses = ["paid", "due", "overdue"] as const;
export type BillStatus = (typeof billStatuses)[number];

export function calculateOpenBillsTotal(bills: readonly { amount: number; isSettled: boolean }[]) {
  const total = bills.reduce((sum, bill) => sum + (bill.isSettled ? 0 : bill.amount), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function getBillStatus(input: {
  dueDate: string;
  isSettled: boolean;
  today: string;
}): BillStatus {
  if (input.isSettled) return "paid";
  return input.dueDate < input.today ? "overdue" : "due";
}

export function listRecurringBillOccurrences(input: {
  ruleId: string;
  anchorDate: string;
  startDate: string;
  endDate?: string | null;
  dueDate: string;
  frequency: RecurrenceFrequency;
  period: string;
}) {
  const dueDay = Number(input.dueDate.slice(8, 10));

  return listRecurrenceDatesInPeriod({
    anchorDate: input.anchorDate,
    startDate: input.startDate,
    endDate: input.endDate,
    frequency: input.frequency,
    period: input.period,
  }).map((purchaseDate) => ({
    id: `${input.ruleId}:${purchaseDate}`,
    purchaseDate,
    dueDate: withClampedDay(purchaseDate, dueDay),
  }));
}

function withClampedDay(date: string, day: number) {
  const [year, month] = date.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
    Math.min(day, lastDay),
  ).padStart(2, "0")}`;
}

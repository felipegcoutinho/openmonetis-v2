import { roundToTwoDecimals } from "./money";
import { resolveRecurringDueDate } from "./recurring-expenses";
import {
  addMonthsToPeriod,
  listRecurrenceDatesInPeriod,
  type RecurrenceFrequency,
} from "./transactions";

export const billStatuses = ["paid", "due", "overdue"] as const;
export type BillStatus = (typeof billStatuses)[number];

export function isPayable(input: {
  type?: string;
  origin?: string;
  paymentMethod?: string | null;
  dueDate: string | null;
}) {
  return (
    input.type === "expense" &&
    (input.origin === undefined || input.origin === "regular") &&
    input.paymentMethod != null &&
    input.paymentMethod !== "credit_card" &&
    input.dueDate !== null
  );
}

export function calculateOpenBillsTotal(bills: readonly { amount: number; isSettled: boolean }[]) {
  const total = bills.reduce((sum, bill) => sum + (bill.isSettled ? 0 : bill.amount), 0);
  return roundToTwoDecimals(total);
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

  configuredEndDate?: string | null;
  anchorDate: string;
  startDate: string;
  endDate?: string | null;
  dueDate: string | null;
  frequency: RecurrenceFrequency;
  period: string;
  includeAdjacent?: boolean;
}) {
  return (input.includeAdjacent ? Array.from({ length: 27 }, (_, index) => index - 13) : [-1, 0, 1])
    .flatMap((offset) =>
      listRecurrenceDatesInPeriod({
        anchorDate: input.anchorDate,
        startDate: input.startDate,
        endDate: input.endDate,
        frequency: input.frequency,
        period: addMonthsToPeriod(input.period, offset),
      }).map((purchaseDate) => ({
        id: `${input.ruleId}:${purchaseDate}`,
        purchaseDate,
        dueDate: resolveRecurringDueDate(purchaseDate, input.dueDate) ?? purchaseDate,
      })),
    )
    .filter(
      (item) =>
        (input.includeAdjacent || item.dueDate.slice(0, 7) === input.period) &&
        (!input.configuredEndDate || item.dueDate <= input.configuredEndDate),
    );
}

import {
  addMonthsToPeriod,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
} from "./transactions";

export type RecurringOccurrenceAllocation = {
  seriesId: string;
  ruleId: string;
  occurrenceDate: string;
  period: string;
  personId: string;
  amount: number;
};

export type RecurringAllocationRule = {
  id: string;
  seriesId: string;
  anchorDate: string;
  personId: string;
  amount: string | number;
  startDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  splits: Array<{ personId: string; amount: string | number }>;
};

export function projectRecurringMonthAllocations(input: {
  period: string;
  rules: RecurringAllocationRule[];
}): RecurringOccurrenceAllocation[] {
  return input.rules.flatMap((rule) => {
    const allocations = rule.splits.length
      ? rule.splits
      : [{ personId: rule.personId, amount: rule.amount }];
    const dates = listRecurrenceDatesInPeriod({
      anchorDate: rule.anchorDate,
      startDate: rule.startDate,
      endDate: rule.endDate,
      frequency: rule.frequency,
      period: input.period,
    });

    return dates.flatMap((occurrenceDate) =>
      allocations.map((allocation) => ({
        seriesId: rule.seriesId,
        ruleId: rule.id,
        occurrenceDate,
        period: input.period,
        personId: allocation.personId,
        amount: fromCents(toCents(allocation.amount)),
      })),
    );
  });
}

export function getRecurringDueDate(ruleDueDate: string | null, occurrenceDate: string) {
  if (!ruleDueDate) return null;
  const day = Number(ruleDueDate.slice(8, 10));
  const [year, month] = occurrenceDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${occurrenceDate.slice(0, 7)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function getRecurringOccurrenceDeliveryDate(input: {
  occurrenceDate: string;
  dueDate: string | null;
  paymentMethod: PaymentMethod;
}) {
  if (input.paymentMethod === "boleto") {
    return `${(input.dueDate ?? input.occurrenceDate).slice(0, 7)}-01`;
  }
  return input.occurrenceDate;
}

export function canDeliverRecurringOccurrence(input: {
  activationDate: string;
  businessDate: string;
  deliveryDate: string;
}) {
  return input.deliveryDate >= input.activationDate && input.deliveryDate <= input.businessDate;
}

export function getNextRecurringOccurrenceDate(input: {
  anchorDate?: string;
  currentDate: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  startDate: string;
}) {
  const currentPeriod = input.currentDate.slice(0, 7);

  for (let offset = 0; offset <= 24; offset += 1) {
    const period = addMonthsToPeriod(currentPeriod, offset);
    const next = listRecurrenceDatesInPeriod({
      anchorDate: input.anchorDate,
      startDate: input.startDate,
      endDate: input.endDate,
      frequency: input.frequency,
      period,
    }).find((date) => date > input.currentDate);
    if (next) return next;
  }

  return null;
}

export function isValidRecurringExpenseOccurrence(input: {
  anchorDate?: string;
  date: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  startDate: string;
}) {
  return listRecurrenceDatesInPeriod({
    anchorDate: input.anchorDate,
    startDate: input.startDate,
    endDate: input.endDate,
    frequency: input.frequency,
    period: input.date.slice(0, 7),
  }).includes(input.date);
}

export function projectRecurringExpenseOccurrences(input: {
  anchorDate?: string;
  endDate: string | null;
  frequency: RecurrenceFrequency;
  periods: string[];
  startDate: string;
}) {
  return input.periods.flatMap((period) =>
    listRecurrenceDatesInPeriod({
      anchorDate: input.anchorDate,
      startDate: input.startDate,
      endDate: input.endDate,
      frequency: input.frequency,
      period,
    }).map((date) => ({ date, period })),
  );
}

function toCents(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new RangeError("invalid_recurring_allocation_amount");
  return Math.round(amount * 100);
}

function fromCents(value: number) {
  return value / 100;
}

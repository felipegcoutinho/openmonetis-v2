export const cardBrands = ["visa", "mastercard", "elo", "amex", "hipercard", "other"] as const;
export const cardStatuses = ["active", "inactive"] as const;

export type CardBrand = (typeof cardBrands)[number];
export type CardStatus = (typeof cardStatuses)[number];
export const cardInvoiceStatuses = ["open", "closed", "overdue", "paid"] as const;
export type CardInvoiceStatus = (typeof cardInvoiceStatuses)[number];
export const cardClosingRuleTypes = ["fixedDay", "daysBeforeDue"] as const;
export type CardClosingRuleType = (typeof cardClosingRuleTypes)[number];
export const cardClosingOffsetModes = ["calendarDays", "weekdays"] as const;
export type CardClosingOffsetMode = (typeof cardClosingOffsetModes)[number];

export type CardClosingRule =
  | { type: "fixedDay"; closingDay: number }
  | { type: "daysBeforeDue"; days: number; mode: CardClosingOffsetMode };

export function resolveCardClosingRule(input: {
  closingRuleType: CardClosingRuleType;
  closingDay: number | null;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
}): CardClosingRule {
  return input.closingRuleType === "daysBeforeDue"
    ? {
        type: "daysBeforeDue",
        days: input.closingOffsetDays ?? 1,
        mode: input.closingOffsetMode ?? "calendarDays",
      }
    : { type: "fixedDay", closingDay: input.closingDay ?? 1 };
}

export type CardInvoiceMovement = {
  period: string;
  amount: number;
};

export function calculateCardInvoiceHistory(movements: CardInvoiceMovement[], periods: string[]) {
  const centsByPeriod = sumInvoiceCentsByPeriod(movements);
  return periods.map((period) => ({
    period,
    amount: fromCents(Math.max(0, centsByPeriod.get(period) ?? 0)),
  }));
}

export function calculateCardCycleSpending(input: {
  previousClosingDate: string;
  closingDate: string;
  movements: { purchaseDate: string; amount: number }[];
}) {
  const start = new Date(`${input.previousClosingDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const startDate = toDateString(start);
  const centsByDate = new Map<string, number>();
  let openingCents = 0;
  for (const movement of input.movements) {
    if (movement.purchaseDate < startDate || movement.purchaseDate > input.closingDate) {
      openingCents -= toCents(movement.amount);
      continue;
    }
    centsByDate.set(
      movement.purchaseDate,
      (centsByDate.get(movement.purchaseDate) ?? 0) - toCents(movement.amount),
    );
  }

  const daily: { date: string; amount: number; cumulativeAmount: number }[] = [];
  let cumulativeCents = openingCents;
  for (
    const date = start;
    toDateString(date) <= input.closingDate;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const dateString = toDateString(date);
    const amountCents = centsByDate.get(dateString) ?? 0;
    cumulativeCents += amountCents;
    daily.push({
      date: dateString,
      amount: fromCents(amountCents),
      cumulativeAmount: fromCents(cumulativeCents),
    });
  }
  return {
    startDate,
    endDate: input.closingDate,
    openingAmount: fromCents(openingCents),
    daily,
  };
}

export type CardInvoiceSummary = {
  period: string;
  amount: number;
  status: CardInvoiceStatus;
  closingDate: string;
  dueDate: string;
  totalLimit: number;
  usedLimit: number;
  availableLimit: number;
  usagePercentage: number;
};

export type CardCreateDraft = {
  userId: string;
  accountId: string;
  name: string;
  brand: CardBrand;
  status: CardStatus;
  closingDay: number | null;
  closingRuleType: CardClosingRuleType;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
  dueDay: number;
  limit: string;
  logo: string | null;
  note: string | null;
};

type CreateCardDraftInput = Omit<CardCreateDraft, "limit"> & { limit: number };

export function createCardDraft(input: CreateCardDraftInput): CardCreateDraft {
  return {
    ...input,
    name: input.name.trim(),
    logo: input.logo?.trim() || null,
    note: input.note?.trim() || null,
    limit: input.limit.toFixed(2),
  };
}

export function calculateCardInvoiceSummary(input: {
  period: string;
  limit: number;
  closingDay: number | null;
  closingRule?: CardClosingRule;
  dueDay: number;
  today: string;
  paymentStatus: "pending" | "paid";
  movements: CardInvoiceMovement[];
  payments?: CardInvoiceMovement[];
  paidPeriods: string[];
  persistedClosingDate?: string | null;
  persistedDueDate?: string | null;
  datesCustomized?: boolean;
  hasPayments?: boolean;
}): CardInvoiceSummary {
  const invoiceCentsByPeriod = sumInvoiceCentsByPeriod(input.movements);
  const paymentCentsByPeriod = new Map<string, number>();

  for (const payment of input.payments ?? []) {
    paymentCentsByPeriod.set(
      payment.period,
      (paymentCentsByPeriod.get(payment.period) ?? 0) + toCents(payment.amount),
    );
  }

  const paidPeriods = new Set(input.paidPeriods);
  const amountCents = Math.max(0, invoiceCentsByPeriod.get(input.period) ?? 0);
  const usedLimitCents = Math.max(
    0,
    [...invoiceCentsByPeriod].reduce(
      (total, [period, amount]) =>
        paidPeriods.has(period)
          ? total
          : total + Math.max(0, amount - (paymentCentsByPeriod.get(period) ?? 0)),
      0,
    ),
  );
  const limitCents = toCents(input.limit);
  const availableLimitCents = Math.max(0, limitCents - usedLimitCents);
  const calculatedDates = getInvoiceDates({
    period: input.period,
    closingDay: input.closingDay,
    closingRule: input.closingRule,
    dueDay: input.dueDay,
  });
  const persistedDates =
    input.persistedClosingDate && input.persistedDueDate
      ? { closingDate: input.persistedClosingDate, dueDate: input.persistedDueDate }
      : null;
  const shouldPreservePersistedDates =
    persistedDates !== null &&
    (input.datesCustomized === true ||
      input.paymentStatus === "paid" ||
      input.hasPayments === true ||
      input.period < input.today.slice(0, 7));
  const closingDate = shouldPreservePersistedDates
    ? persistedDates.closingDate
    : calculatedDates.closingDate;
  const dueDate = shouldPreservePersistedDates ? persistedDates.dueDate : calculatedDates.dueDate;

  return {
    period: input.period,
    amount: fromCents(amountCents),
    status: resolveInvoiceStatus({
      paymentStatus: input.paymentStatus,
      today: input.today,
      closingDate,
      dueDate,
    }),
    closingDate,
    dueDate,
    totalLimit: fromCents(limitCents),
    usedLimit: fromCents(usedLimitCents),
    availableLimit: fromCents(availableLimitCents),
    usagePercentage: limitCents > 0 ? Math.round((usedLimitCents / limitCents) * 10_000) / 100 : 0,
  };
}

function sumInvoiceCentsByPeriod(movements: CardInvoiceMovement[]) {
  const centsByPeriod = new Map<string, number>();
  for (const movement of movements) {
    centsByPeriod.set(
      movement.period,
      (centsByPeriod.get(movement.period) ?? 0) - toCents(movement.amount),
    );
  }
  return centsByPeriod;
}

export function areValidInvoiceDates(input: { closingDate: string; dueDate: string }) {
  return input.closingDate < input.dueDate;
}

export function getInvoiceDates(input: {
  period: string;
  closingDay: number | null;
  closingRule?: CardClosingRule;
  dueDay: number;
}) {
  const [year, month] = input.period.split("-").map(Number) as [number, number];
  const invoiceMonthIndex = month - 1;
  const nominalDueDate = createClampedDate(year, invoiceMonthIndex, input.dueDay);
  const dueDate = moveToNextWeekday(nominalDueDate);
  const closingRule = input.closingRule ?? {
    type: "fixedDay" as const,
    closingDay: input.closingDay ?? 1,
  };
  const closingDate =
    closingRule.type === "fixedDay"
      ? createClampedDate(
          year,
          invoiceMonthIndex + (input.dueDay <= closingRule.closingDay ? -1 : 0),
          closingRule.closingDay,
        )
      : subtractDays(dueDate, closingRule.days, closingRule.mode);

  return {
    closingDate: toDateString(closingDate),
    dueDate: toDateString(dueDate),
  };
}

function moveToNextWeekday(date: Date) {
  const result = new Date(date);
  if (result.getUTCDay() === 6) result.setUTCDate(result.getUTCDate() + 2);
  if (result.getUTCDay() === 0) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function subtractDays(date: Date, days: number, mode: CardClosingOffsetMode) {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() - 1);
    if (mode === "calendarDays" || (result.getUTCDay() !== 0 && result.getUTCDay() !== 6)) {
      remaining -= 1;
    }
  }
  return result;
}

function resolveInvoiceStatus(input: {
  paymentStatus: "pending" | "paid";
  today: string;
  closingDate: string;
  dueDate: string;
}): CardInvoiceStatus {
  if (input.paymentStatus === "paid") return "paid";
  if (input.today > input.dueDate) return "overdue";
  if (input.today > input.closingDate) return "closed";
  return "open";
}

function createClampedDate(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(amount: number) {
  return amount / 100;
}

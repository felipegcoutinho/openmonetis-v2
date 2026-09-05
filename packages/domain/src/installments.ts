import { addMonthsToPeriod, type PaymentMethod } from "./transactions";

export const installmentSeriesStatuses = ["open", "completed", "incomplete"] as const;
export const installmentReportStatuses = ["open", "completed", "all"] as const;
export const installmentPaymentStatuses = ["paid", "pending"] as const;

export type InstallmentSeriesStatus = (typeof installmentSeriesStatuses)[number];
export type InstallmentReportStatus = (typeof installmentReportStatuses)[number];
export type InstallmentPaymentStatus = (typeof installmentPaymentStatuses)[number];

export type InstallmentReportRow = {
  id: string;
  seriesId: string;
  name: string;
  amount: string | number;
  purchaseDate: string;
  period: string;
  dueDate: string | null;
  currentInstallment: number;
  paymentMethod: PaymentMethod;
  isSettled: boolean | null;
  invoicePaymentStatus: "pending" | "paid" | null;
  totalInstallments: number;
  trackedFromInstallment: number;
  originalAmount: string | number;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  cardId: string | null;
  cardName: string | null;
  cardLogo: string | null;
  cardDueDay: number | null;
  accountId: string | null;
  accountName: string | null;
  accountLogo: string | null;
};

export type InstallmentQuoteItem = Pick<
  InstallmentReportRow,
  "amount" | "paymentMethod" | "isSettled" | "invoicePaymentStatus"
>;

export type InstallmentAnticipationItem = {
  amount: string | number;
  personId: string;
  splitShares?: Array<{ personId: string; amount: string | number }>;
};

export type InstallmentAnticipationCalculation = {
  installmentCount: number;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  discountAllocations: Array<{ personId: string; amount: number }>;
};

export type InstallmentAnticipationUndoItem = InstallmentAnticipationItem & { id: string };

export type InstallmentAnticipationUndoCalculation = {
  restoredInstallmentCount: number;
  remainingInstallmentCount: number;
  restoredDiscount: number;
  remainingDiscount: number;
  remainingDiscountAllocations: Array<{ personId: string; amount: number }>;
};

export type InstallmentReportOptions = {
  referencePeriod: string;
  status: InstallmentReportStatus;
  q?: string;
};

export type InstallmentDetailCalculation = {
  id: string;
  installmentNumber: number;
  period: string;
  purchaseDate: string;
  amount: number;
  dueDate: string | null;
  status: InstallmentPaymentStatus;
  isDueInReferencePeriod: boolean;
};

export type InstallmentGroupCalculation = {
  seriesId: string;
  name: string;
  paymentMethod: PaymentMethod;
  originalAmount: number;
  totalInstallments: number;
  trackedFromInstallment: number;
  trackedInstallmentCount: number;
  untrackedInstallmentCount: number;
  scheduledInstallmentCount: number;
  missingInstallmentCount: number;
  paidInstallmentCount: number;
  pendingInstallmentCount: number;
  trackedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  progressPercentage: number;
  nextDueDate: string | null;
  nextPeriod: string | null;
  endPeriod: string | null;
  status: InstallmentSeriesStatus;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  cardId: string | null;
  cardName: string | null;
  cardLogo: string | null;
  accountId: string | null;
  accountName: string | null;
  accountLogo: string | null;
  installments: InstallmentDetailCalculation[];
};

export type InstallmentsReportCalculation = {
  referencePeriod: string;
  summary: {
    openSeriesCount: number;
    totalPendingAmount: number;
    dueInPeriodAmount: number;
    trackedAmount: number;
    paidInstallmentCount: number;
    pendingInstallmentCount: number;
    trackedInstallmentCount: number;
    untrackedInstallmentCount: number;
    missingInstallmentCount: number;
  };
  groups: InstallmentGroupCalculation[];
};

export type DashboardInstallmentExpense = {
  amount: number;
  categoryIcon: string | null;
  currentInstallment: number;
  endPeriod: string | null;
  isPaid: boolean;
  name: string;
  pendingAmount: number;
  pendingInstallmentCount: number;
  personAvatarUrl: string | null;
  personName: string;
  progressPercentage: number;
  seriesId: string;
  totalInstallments: number;
};

export function calculateDashboardInstallmentExpenses(
  rows: InstallmentReportRow[],
  referencePeriod: string,
): DashboardInstallmentExpense[] {
  const report = calculateInstallmentsReport(rows, {
    referencePeriod,
    status: "all",
  });

  return report.groups
    .flatMap((group) => {
      const current = group.installments.find(
        (installment) => installment.period === referencePeriod,
      );
      if (!current) return [];

      return [
        {
          amount: current.amount,
          categoryIcon: group.categoryIcon,
          currentInstallment: current.installmentNumber,
          endPeriod: group.endPeriod,
          isPaid: current.status === "paid",
          name: group.name,
          pendingAmount: group.pendingAmount,
          pendingInstallmentCount: group.pendingInstallmentCount,
          personAvatarUrl: group.personAvatarUrl,
          personName: group.personName,
          progressPercentage: roundPercentage(
            (current.installmentNumber / group.totalInstallments) * 100,
          ),
          seriesId: group.seriesId,
          totalInstallments: group.totalInstallments,
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(left.isPaid) - Number(right.isPaid) ||
        left.totalInstallments -
          left.currentInstallment -
          (right.totalInstallments - right.currentInstallment) ||
        left.name.localeCompare(right.name, "pt-BR") ||
        left.seriesId.localeCompare(right.seriesId),
    );
}

export function calculateInstallmentsReport(
  rows: InstallmentReportRow[],
  options: InstallmentReportOptions,
): InstallmentsReportCalculation {
  const rowsBySeries = new Map<string, InstallmentReportRow[]>();

  for (const row of rows) {
    const seriesRows = rowsBySeries.get(row.seriesId) ?? [];
    seriesRows.push(row);
    rowsBySeries.set(row.seriesId, seriesRows);
  }

  const search = normalizeSearch(options.q);
  const groups = [...rowsBySeries.values()]
    .map((seriesRows) => calculateGroup(seriesRows, options.referencePeriod))
    .filter((group) => matchesStatus(group.status, options.status))
    .filter((group) => matchesSearch(group, search))
    .sort(compareGroups);

  return {
    referencePeriod: options.referencePeriod,
    summary: calculateSummary(groups, options.referencePeriod),
    groups,
  };
}

export function calculateInstallmentQuote(items: Array<Pick<InstallmentQuoteItem, "amount">>) {
  const totalCents = items.reduce((total, item) => total + moneyToCents(item.amount), 0);

  return {
    installmentCount: items.length,
    totalAmount: centsToMoney(totalCents),
  };
}

export function calculateInstallmentAllocationTotal(input: {
  originalTransactionAmount: string | number;
  totalInstallments: number;
  trackedFromInstallment: number;
  trackedTransactionAmounts: Array<string | number>;
  trackedAllocationAmounts: Array<string | number>;
}) {
  const trackedAllocationCents = sumValidatedCents(input.trackedAllocationAmounts);
  if (input.trackedFromInstallment <= 1) return centsToMoney(trackedAllocationCents);

  const trackedTransactionCents = sumValidatedCents(input.trackedTransactionAmounts);
  if (trackedTransactionCents === 0) {
    throw new RangeError("invalid_installment_transaction_total");
  }

  const originalAllocationCents = Math.round(
    (validatedCents(input.originalTransactionAmount) * trackedAllocationCents) /
      trackedTransactionCents,
  );
  const baseInstallmentCents = Math.floor(originalAllocationCents / input.totalInstallments);
  const remainder = originalAllocationCents % input.totalInstallments;
  let untrackedAllocationCents = 0;

  for (let installment = 1; installment < input.trackedFromInstallment; installment += 1) {
    untrackedAllocationCents += baseInstallmentCents + (installment <= remainder ? 1 : 0);
  }

  return centsToMoney(untrackedAllocationCents + trackedAllocationCents);
}

export function calculateInstallmentAnticipation(
  items: InstallmentAnticipationItem[],
  discount: number,
): InstallmentAnticipationCalculation {
  if (items.length === 0) throw new RangeError("installments_required");

  const totalCents = items.reduce((total, item) => total + moneyToCents(item.amount), 0);
  const discountCents = moneyToCents(discount);
  if (discountCents > totalCents) throw new RangeError("discount_exceeds_total");

  const responsibilityByPerson = new Map<string, number>();
  for (const item of items) {
    const shares = item.splitShares?.length
      ? item.splitShares
      : [{ personId: item.personId, amount: item.amount }];
    for (const share of shares) {
      responsibilityByPerson.set(
        share.personId,
        (responsibilityByPerson.get(share.personId) ?? 0) + moneyToCents(share.amount),
      );
    }
  }

  return {
    installmentCount: items.length,
    totalAmount: centsToMoney(totalCents),
    discount: centsToMoney(discountCents),
    finalAmount: centsToMoney(totalCents - discountCents),
    discountAllocations: allocateCents(responsibilityByPerson, discountCents),
  };
}

export function calculateInstallmentAnticipationUndo(
  items: InstallmentAnticipationUndoItem[],
  installmentIds: string[],
  discount: number,
): InstallmentAnticipationUndoCalculation {
  if (items.length === 0 || installmentIds.length === 0) {
    throw new RangeError("installments_required");
  }
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const selectedIds = new Set(installmentIds);
  if (itemsById.size !== items.length || selectedIds.size !== installmentIds.length) {
    throw new RangeError("installments_must_be_unique");
  }
  if (installmentIds.some((id) => !itemsById.has(id))) {
    throw new RangeError("invalid_installment_selection");
  }

  const orderedItems = [...items].sort((left, right) => left.id.localeCompare(right.id));
  const itemWeights = new Map(orderedItems.map((item) => [item.id, moneyToCents(item.amount)]));
  const totalCents = [...itemWeights.values()].reduce((total, amount) => total + amount, 0);
  const discountCents = moneyToCents(discount);
  if (discountCents > totalCents) throw new RangeError("discount_exceeds_total");

  const discountByItem = allocateCentsByKey(itemWeights, discountCents);
  const restoredDiscountCents = installmentIds.reduce(
    (total, installmentId) => total + (discountByItem.get(installmentId) ?? 0),
    0,
  );
  const remainingItems = orderedItems.filter((item) => !selectedIds.has(item.id));
  const remainingDiscountCents = discountCents - restoredDiscountCents;
  const remainingDiscount = centsToMoney(remainingDiscountCents);
  const remainingCalculation = remainingItems.length
    ? calculateInstallmentAnticipation(remainingItems, remainingDiscount)
    : null;

  return {
    restoredInstallmentCount: selectedIds.size,
    remainingInstallmentCount: remainingItems.length,
    restoredDiscount: centsToMoney(restoredDiscountCents),
    remainingDiscount,
    remainingDiscountAllocations: remainingCalculation?.discountAllocations ?? [],
  };
}

export function isInstallmentPaid(
  row: Pick<InstallmentReportRow, "paymentMethod" | "isSettled" | "invoicePaymentStatus">,
) {
  return row.paymentMethod === "credit_card"
    ? row.invoicePaymentStatus === "paid"
    : row.isSettled === true;
}

export function moneyToCents(value: string | number) {
  const rawValue = String(value).trim();
  const decimalMatch = rawValue.match(/^[+-]?(\d+)(?:\.(\d+))?$/);

  if (decimalMatch) {
    const whole = Number(decimalMatch[1]);
    const fraction = decimalMatch[2] ?? "";
    const hundredths = Number(fraction.slice(0, 2).padEnd(2, "0"));
    const shouldRoundUp = Number(fraction[2] ?? "0") >= 5;
    return whole * 100 + hundredths + (shouldRoundUp ? 1 : 0);
  }

  const numericValue = Math.abs(Number(value));
  return Number.isFinite(numericValue) ? Math.round((numericValue + Number.EPSILON) * 100) : 0;
}

function sumValidatedCents(values: Array<string | number>): number {
  return values.reduce<number>((total, value) => total + validatedCents(value), 0);
}

function validatedCents(value: string | number): number {
  const amount = Math.abs(Number(value));
  if (!Number.isFinite(amount)) throw new RangeError("invalid_installment_amount");
  return Math.round(amount * 100);
}

function calculateGroup(
  rows: InstallmentReportRow[],
  referencePeriod: string,
): InstallmentGroupCalculation {
  const representative = [...rows].sort(compareRows)[0] as InstallmentReportRow;

  const totalInstallments = Math.max(0, representative.totalInstallments);
  const trackedFromInstallment = Math.min(
    Math.max(1, representative.trackedFromInstallment),
    Math.max(1, totalInstallments),
  );
  const trackedInstallmentCount = Math.max(totalInstallments - trackedFromInstallment + 1, 0);
  const untrackedInstallmentCount = Math.max(trackedFromInstallment - 1, 0);
  const rowsByInstallment = new Map<number, InstallmentReportRow>();

  for (const row of [...rows].sort(compareRows)) {
    if (
      row.currentInstallment >= trackedFromInstallment &&
      row.currentInstallment <= totalInstallments &&
      !rowsByInstallment.has(row.currentInstallment)
    ) {
      rowsByInstallment.set(row.currentInstallment, row);
    }
  }

  const installments = [...rowsByInstallment.values()].map((row) => {
    const paid = isInstallmentPaid(row);
    return {
      id: row.id,
      installmentNumber: row.currentInstallment,
      period: row.period,
      purchaseDate: row.purchaseDate,
      amount: centsToMoney(moneyToCents(row.amount)),
      dueDate: getEffectiveDueDate(row),
      status: paid ? ("paid" as const) : ("pending" as const),
      isDueInReferencePeriod: row.period === referencePeriod,
    };
  });

  const scheduledInstallmentCount = installments.length;
  const missingInstallmentCount = Math.max(trackedInstallmentCount - scheduledInstallmentCount, 0);
  const paidInstallments = installments.filter((installment) => installment.status === "paid");
  const pendingInstallments = installments
    .filter((installment) => installment.status === "pending")
    .sort(compareInstallments);
  const paidInstallmentCount = paidInstallments.length;
  const pendingInstallmentCount = pendingInstallments.length;
  const trackedAmountCents = installments.reduce(
    (total, installment) => total + moneyToCents(installment.amount),
    0,
  );
  const paidAmountCents = paidInstallments.reduce(
    (total, installment) => total + moneyToCents(installment.amount),
    0,
  );
  const pendingAmountCents = pendingInstallments.reduce(
    (total, installment) => total + moneyToCents(installment.amount),
    0,
  );
  const nextInstallment = pendingInstallments[0] ?? null;
  const status: InstallmentSeriesStatus =
    missingInstallmentCount > 0
      ? "incomplete"
      : pendingInstallmentCount === 0
        ? "completed"
        : "open";

  return {
    seriesId: representative.seriesId,
    name: representative.name,
    paymentMethod: representative.paymentMethod,
    originalAmount: centsToMoney(moneyToCents(representative.originalAmount)),
    totalInstallments,
    trackedFromInstallment,
    trackedInstallmentCount,
    untrackedInstallmentCount,
    scheduledInstallmentCount,
    missingInstallmentCount,
    paidInstallmentCount,
    pendingInstallmentCount,
    trackedAmount: centsToMoney(trackedAmountCents),
    paidAmount: centsToMoney(paidAmountCents),
    pendingAmount: centsToMoney(pendingAmountCents),
    progressPercentage:
      trackedInstallmentCount > 0
        ? roundPercentage((paidInstallmentCount / trackedInstallmentCount) * 100)
        : 0,
    nextDueDate: nextInstallment?.dueDate ?? null,
    nextPeriod: nextInstallment?.period ?? null,
    endPeriod: deriveEndPeriod(installments, totalInstallments),
    status,
    personId: representative.personId,
    personName: representative.personName,
    personAvatarUrl: representative.personAvatarUrl,
    categoryId: representative.categoryId,
    categoryName: representative.categoryName,
    categoryIcon: representative.categoryIcon,
    cardId: representative.cardId,
    cardName: representative.cardName,
    cardLogo: representative.cardLogo,
    accountId: representative.accountId,
    accountName: representative.accountName,
    accountLogo: representative.accountLogo,
    installments,
  };
}

function calculateSummary(
  groups: InstallmentGroupCalculation[],
  referencePeriod: string,
): InstallmentsReportCalculation["summary"] {
  let pendingCents = 0;
  let dueInPeriodCents = 0;
  let trackedCents = 0;
  let paidInstallmentCount = 0;
  let pendingInstallmentCount = 0;
  let trackedInstallmentCount = 0;
  let untrackedInstallmentCount = 0;
  let missingInstallmentCount = 0;

  for (const group of groups) {
    pendingCents += moneyToCents(group.pendingAmount);
    trackedCents += moneyToCents(group.trackedAmount);
    paidInstallmentCount += group.paidInstallmentCount;
    pendingInstallmentCount += group.pendingInstallmentCount;
    trackedInstallmentCount += group.trackedInstallmentCount;
    untrackedInstallmentCount += group.untrackedInstallmentCount;
    missingInstallmentCount += group.missingInstallmentCount;

    for (const installment of group.installments) {
      if (installment.status === "pending" && installment.period === referencePeriod) {
        dueInPeriodCents += moneyToCents(installment.amount);
      }
    }
  }

  return {
    openSeriesCount: groups.filter((group) => group.status !== "completed").length,
    totalPendingAmount: centsToMoney(pendingCents),
    dueInPeriodAmount: centsToMoney(dueInPeriodCents),
    trackedAmount: centsToMoney(trackedCents),
    paidInstallmentCount,
    pendingInstallmentCount,
    trackedInstallmentCount,
    untrackedInstallmentCount,
    missingInstallmentCount,
  };
}

function getEffectiveDueDate(row: InstallmentReportRow) {
  if (row.paymentMethod !== "credit_card") return normalizeDate(row.dueDate);
  if (row.cardDueDay === null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) return null;

  const [year, month] = row.period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dueDay = Math.min(Math.max(row.cardDueDay, 1), lastDay);
  return `${row.period}-${String(dueDay).padStart(2, "0")}`;
}

function deriveEndPeriod(installments: InstallmentDetailCalculation[], totalInstallments: number) {
  const anchor = [...installments].sort(
    (left, right) => left.installmentNumber - right.installmentNumber,
  )[0];
  if (!anchor) return null;

  return addMonthsToPeriod(anchor.period, totalInstallments - anchor.installmentNumber);
}

function normalizeDate(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function normalizeSearch(value: string | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("pt-BR");
  return normalized || null;
}

function matchesSearch(group: InstallmentGroupCalculation, search: string | null) {
  if (!search) return true;

  return [group.name, group.personName, group.categoryName, group.cardName, group.accountName].some(
    (value) => value?.toLocaleLowerCase("pt-BR").includes(search),
  );
}

function matchesStatus(status: InstallmentSeriesStatus, filter: InstallmentReportStatus) {
  if (filter === "all") return true;
  if (filter === "completed") return status === "completed";
  return status !== "completed";
}

function compareRows(left: InstallmentReportRow, right: InstallmentReportRow) {
  return (
    left.currentInstallment - right.currentInstallment ||
    left.period.localeCompare(right.period) ||
    left.id.localeCompare(right.id)
  );
}

function compareInstallments(
  left: InstallmentDetailCalculation,
  right: InstallmentDetailCalculation,
) {
  return (
    left.period.localeCompare(right.period) ||
    compareNullableDates(left.dueDate, right.dueDate) ||
    left.installmentNumber - right.installmentNumber
  );
}

function compareGroups(left: InstallmentGroupCalculation, right: InstallmentGroupCalculation) {
  const leftRank = left.pendingInstallmentCount > 0 ? 0 : left.status === "incomplete" ? 1 : 2;
  const rightRank = right.pendingInstallmentCount > 0 ? 0 : right.status === "incomplete" ? 1 : 2;
  const pendingPeriodDifference =
    leftRank === 0 && rightRank === 0
      ? (left.nextPeriod as string).localeCompare(right.nextPeriod as string) ||
        compareNullableDates(left.nextDueDate, right.nextDueDate)
      : 0;

  return (
    leftRank - rightRank ||
    pendingPeriodDifference ||
    left.name.localeCompare(right.name, "pt-BR") ||
    left.seriesId.localeCompare(right.seriesId)
  );
}

function compareNullableDates(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function centsToMoney(cents: number) {
  return cents / 100;
}

function allocateCents(weights: Map<string, number>, totalCents: number) {
  if (totalCents === 0) return [];
  const entries = [...weights.entries()].filter(([, weight]) => weight > 0);
  const weightTotal = entries.reduce((total, [, weight]) => total + weight, 0);

  let allocated = 0;
  return entries.map(([personId, weight], index) => {
    const amount =
      index === entries.length - 1
        ? totalCents - allocated
        : Math.floor((totalCents * weight) / weightTotal);
    allocated += amount;
    return { personId, amount: centsToMoney(amount) };
  });
}

function allocateCentsByKey(weights: Map<string, number>, totalCents: number) {
  const entries = [...weights.entries()].filter(([, weight]) => weight > 0);
  if (totalCents === 0) return new Map(entries.map(([key]) => [key, 0]));
  const weightTotal = entries.reduce((total, [, weight]) => total + weight, 0);

  let allocated = 0;
  return new Map(
    entries.map(([key, weight], index) => {
      const amount =
        index === entries.length - 1
          ? totalCents - allocated
          : Math.floor((totalCents * weight) / weightTotal);
      allocated += amount;
      return [key, amount];
    }),
  );
}

function roundPercentage(value: number) {
  return Math.round(value * 100) / 100;
}

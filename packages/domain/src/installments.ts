import { roundToTwoDecimals } from "./money";
import {
  addMonthsToPeriod,
  buildTrackedInstallmentSchedule,
  type PaymentMethod,
} from "./transactions";

export const installmentSeriesStatuses = ["open", "completed", "incomplete"] as const;
export const installmentPaymentStatuses = ["paid", "pending"] as const;
/** The report looks ahead from the current month instead of slicing history by month. */
export const installmentOutlookMonthCount = 12;
/**
 * How a payoff discount is informed: an amount off, a percentage off, or the final amount to pay
 * (what bank apps usually show), from which the discount is derived.
 */
export const installmentDiscountTypes = ["amount", "percentage", "payoffAmount"] as const;

export type InstallmentDiscountType = (typeof installmentDiscountTypes)[number];

export type InstallmentSimulationErrorCode =
  | "installment_simulation_invoice_before_current_month"
  | "installment_payoff_invalid_selection";

/** Raised when a simulation cannot be computed; nothing is ever persisted by simulations. */
export class InstallmentSimulationError extends Error {
  constructor(public readonly code: InstallmentSimulationErrorCode) {
    super(code);
  }
}

export type InstallmentSeriesStatus = (typeof installmentSeriesStatuses)[number];
export type InstallmentPaymentStatus = (typeof installmentPaymentStatuses)[number];

export type InstallmentReportRow = {
  id: string;
  seriesId: string;
  name: string;
  note: string | null;
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
  /** The current month: the list shows what is still open plus what ends in it or later. */
  referencePeriod: string;
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
  note: string | null;
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
  /** Pending installments from months before the reference month. */
  overdueInstallmentCount: number;
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
  upcomingMonths: Array<{ period: string; totalAmount: number; activePurchaseCount: number }>;
  summary: {
    openSeriesCount: number;
    totalPendingAmount: number;
    dueInPeriodAmount: number;
    overdueAmount: number;
    lastInstallmentPeriod: string | null;
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
  return calculateInstallmentGroups(rows, referencePeriod)
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
          progressPercentage: roundToTwoDecimals(
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

/** Every purchase, finished or not, regardless of the month being looked at. */
export function calculateInstallmentGroups(
  rows: InstallmentReportRow[],
  referencePeriod: string,
): InstallmentGroupCalculation[] {
  const rowsBySeries = new Map<string, InstallmentReportRow[]>();

  for (const row of rows) {
    const seriesRows = rowsBySeries.get(row.seriesId) ?? [];
    seriesRows.push(row);
    rowsBySeries.set(row.seriesId, seriesRows);
  }

  return [...rowsBySeries.values()]
    .map((seriesRows) => calculateGroup(seriesRows, referencePeriod))
    .sort(compareGroups);
}

/**
 * Purchases from the current month onwards: everything still open (overdue or not started yet
 * included) and the finished ones whose last installment is in the current month or later. A
 * purchase finished this month disappears from the list once the month turns.
 */
export function calculateInstallmentsReport(
  rows: InstallmentReportRow[],
  options: InstallmentReportOptions,
): InstallmentsReportCalculation {
  const allGroups = calculateInstallmentGroups(rows, options.referencePeriod);
  const search = normalizeSearch(options.q);
  const groups = allGroups
    .filter((group) => isShownFromPeriod(group, options.referencePeriod))
    .filter((group) => matchesSearch(group, search));

  return {
    referencePeriod: options.referencePeriod,
    upcomingMonths: calculateUpcomingMonths(allGroups, options.referencePeriod),
    summary: calculateSummary(allGroups, options.referencePeriod),
    groups,
  };
}

function isShownFromPeriod(group: InstallmentGroupCalculation, referencePeriod: string) {
  if (group.status !== "completed") return true;
  return group.installments.some((installment) => installment.period >= referencePeriod);
}

function calculateUpcomingMonths(groups: InstallmentGroupCalculation[], startPeriod: string) {
  const periods = Array.from({ length: installmentOutlookMonthCount }, (_, index) =>
    addMonthsToPeriod(startPeriod, index),
  );
  const totals = new Map(periods.map((period) => [period, 0]));
  const purchaseCounts = new Map(periods.map((period) => [period, 0]));

  for (const group of groups) {
    const groupPeriods = new Set<string>();
    for (const installment of group.installments) {
      const total = totals.get(installment.period);
      if (total !== undefined) {
        totals.set(installment.period, total + moneyToCents(installment.amount));
        groupPeriods.add(installment.period);
      }
    }
    for (const period of groupPeriods) {
      purchaseCounts.set(period, (purchaseCounts.get(period) ?? 0) + 1);
    }
  }

  return periods.map((period) => ({
    period,
    totalAmount: centsToMoney(totals.get(period) ?? 0),
    activePurchaseCount: purchaseCounts.get(period) ?? 0,
  }));
}

export type InstallmentPurchaseSimulation = {
  installments: Array<{ installmentNumber: number; period: string; amount: number }>;
  installmentAmount: number;
  firstPeriod: string;
  endPeriod: string;
  upcomingMonths: Array<{ period: string; amount: number }>;
};

/**
 * Splits a purchase that does not exist yet exactly like a real credit card series and lays it
 * over the report's outlook window. Nothing is persisted, so no other total is affected.
 */
export function simulateInstallmentPurchase(input: {
  amount: number;
  installmentCount: number;
  /** Invoice of the first installment: chosen by the user or resolved from the closing rule. */
  firstPeriod: string;
  outlookStartPeriod: string;
}): InstallmentPurchaseSimulation {
  if (input.firstPeriod < input.outlookStartPeriod) {
    throw new InstallmentSimulationError("installment_simulation_invoice_before_current_month");
  }
  const schedule = buildTrackedInstallmentSchedule({
    totalAmount: input.amount,
    installmentCount: input.installmentCount,
    startInstallment: 1,
    basePeriod: input.firstPeriod,
    paymentMethod: "credit_card",
  });
  const centsByPeriod = new Map(
    schedule.map((installment) => [installment.period, moneyToCents(installment.amount)]),
  );
  const first = schedule[0] as (typeof schedule)[number];
  const last = schedule.at(-1) as (typeof schedule)[number];

  return {
    installments: schedule.map((installment) => ({
      installmentNumber: installment.currentInstallment,
      period: installment.period,
      amount: installment.amount,
    })),
    installmentAmount: first.amount,
    firstPeriod: first.period,
    endPeriod: last.period,
    upcomingMonths: Array.from({ length: installmentOutlookMonthCount }, (_, index) => {
      const period = addMonthsToPeriod(input.outlookStartPeriod, index);
      return { period, amount: centsToMoney(centsByPeriod.get(period) ?? 0) };
    }),
  };
}

export type InstallmentPayoffSimulation = {
  payoffPeriod: string;
  installmentCount: number;
  totalAmount: number;
  discountAmount: number;
  discountPercentage: number;
  payoffAmount: number;
  /** Installments that would no longer be charged in the month after the payoff. */
  nextMonthReliefAmount: number;
  lastInstallmentPeriod: { current: string | null; simulated: string | null };
  upcomingMonths: Array<{
    period: string;
    keptAmount: number;
    releasedAmount: number;
    payoffAmount: number;
  }>;
  series: Array<{
    seriesId: string;
    releasedInstallmentCount: number;
    releasedAmount: number;
    /**
     * True when the discount would exceed what is selected, or the amount to pay would be above
     * it; the discount is then left out (zero).
     */
    discountOutOfRange: boolean;
    discountAmount: number;
    discountPercentage: number;
    payoffAmount: number;
    remainingInstallmentCount: number;
    remainingAmount: number;
    /** Last month still charged after the payoff; the payoff month when nothing remains. */
    endPeriod: string;
  }>;
};

export type InstallmentPayoffDiscount = {
  seriesId: string;
  type: InstallmentDiscountType;
  value: number;
};

/**
 * Discount, in cents, over the installments selected in one purchase. An out-of-range discount is
 * reported instead of failing the whole simulation, so the purchase can be pointed out.
 */
function calculatePayoffDiscountCents(
  selectedCents: number,
  discount: InstallmentPayoffDiscount | undefined,
) {
  if (!discount) return { discountCents: 0, outOfRange: false };
  const valueCents = moneyToCents(Math.max(discount.value, 0));
  const discountCents =
    discount.type === "percentage"
      ? Math.round((selectedCents * Math.min(Math.max(discount.value, 0), 100)) / 100)
      : discount.type === "payoffAmount"
        ? selectedCents - valueCents
        : valueCents;
  return discountCents < 0 || discountCents > selectedCents
    ? { discountCents: 0, outOfRange: true }
    : { discountCents, outOfRange: false };
}

function percentageOf(partCents: number, totalCents: number) {
  return totalCents > 0 ? roundToTwoDecimals((partCents / totalCents) * 100) : 0;
}

/**
 * Pays the selected pending installments in one go in `payoffPeriod`, each purchase with its own
 * optional discount, and shows what each month and purchase would look like afterwards. Purely
 * hypothetical.
 */
export function simulateInstallmentPayoff(input: {
  groups: InstallmentGroupCalculation[];
  installmentIds: string[];
  /** At most one per purchase; only purchases with selected installments may have one. */
  discounts: InstallmentPayoffDiscount[];
  /** Month that receives the payoff, which is also where the outlook starts. */
  payoffPeriod: string;
}): InstallmentPayoffSimulation {
  const selectedIds = new Set(input.installmentIds);
  const selectedBySeries = new Map<string, InstallmentDetailCalculation[]>();
  for (const group of input.groups) {
    for (const installment of group.installments) {
      if (installment.status !== "pending" || !selectedIds.has(installment.id)) continue;
      const selected = selectedBySeries.get(group.seriesId) ?? [];
      selected.push(installment);
      selectedBySeries.set(group.seriesId, selected);
    }
  }
  const selected = [...selectedBySeries.values()].flat();
  if (selected.length === 0 || selected.length !== selectedIds.size) {
    throw new InstallmentSimulationError("installment_payoff_invalid_selection");
  }

  const discountBySeries = new Map(input.discounts.map((item) => [item.seriesId, item]));
  if (
    discountBySeries.size !== input.discounts.length ||
    input.discounts.some((item) => !selectedBySeries.has(item.seriesId))
  ) {
    throw new InstallmentSimulationError("installment_payoff_invalid_selection");
  }

  const centsBySeries = new Map(
    [...selectedBySeries.entries()].map(([seriesId, released]) => {
      const selectedCents = released.reduce((sum, item) => sum + moneyToCents(item.amount), 0);
      const discount = calculatePayoffDiscountCents(selectedCents, discountBySeries.get(seriesId));
      return [seriesId, { selectedCents, ...discount }] as const;
    }),
  );
  const totalCents = [...centsBySeries.values()].reduce((sum, item) => sum + item.selectedCents, 0);
  const discountCents = [...centsBySeries.values()].reduce(
    (sum, item) => sum + item.discountCents,
    0,
  );
  const payoffCents = totalCents - discountCents;

  const releasedCentsByPeriod = new Map<string, number>();
  for (const item of selected) {
    releasedCentsByPeriod.set(
      item.period,
      (releasedCentsByPeriod.get(item.period) ?? 0) + moneyToCents(item.amount),
    );
  }
  const upcomingMonths = calculateUpcomingMonths(input.groups, input.payoffPeriod).map((month) => {
    const releasedCents = releasedCentsByPeriod.get(month.period) ?? 0;
    return {
      period: month.period,
      keptAmount: centsToMoney(moneyToCents(month.totalAmount) - releasedCents),
      releasedAmount: centsToMoney(releasedCents),
      payoffAmount: month.period === input.payoffPeriod ? centsToMoney(payoffCents) : 0,
    };
  });

  const series = [...selectedBySeries.entries()].map(([seriesId, released]) => {
    const group = input.groups.find(
      (item) => item.seriesId === seriesId,
    ) as InstallmentGroupCalculation;
    const releasedIds = new Set(released.map((item) => item.id));
    const remaining = group.installments.filter(
      (installment) => installment.status === "pending" && !releasedIds.has(installment.id),
    );
    const lastRemaining = remaining.reduce<string | null>(
      (last, installment) => (!last || installment.period > last ? installment.period : last),
      null,
    );
    const {
      selectedCents,
      discountCents: seriesDiscountCents,
      outOfRange,
    } = centsBySeries.get(seriesId) as {
      selectedCents: number;
      discountCents: number;
      outOfRange: boolean;
    };
    return {
      seriesId,
      releasedInstallmentCount: released.length,
      releasedAmount: centsToMoney(selectedCents),
      discountOutOfRange: outOfRange,
      discountAmount: centsToMoney(seriesDiscountCents),
      discountPercentage: percentageOf(seriesDiscountCents, selectedCents),
      payoffAmount: centsToMoney(selectedCents - seriesDiscountCents),
      remainingInstallmentCount: remaining.length,
      remainingAmount: centsToMoney(
        remaining.reduce((sum, installment) => sum + moneyToCents(installment.amount), 0),
      ),
      endPeriod:
        lastRemaining && lastRemaining > input.payoffPeriod ? lastRemaining : input.payoffPeriod,
    };
  });

  const simulatedEndBySeries = new Map(
    series.map((item) => [
      item.seriesId,
      item.remainingInstallmentCount > 0 ? item.endPeriod : null,
    ]),
  );
  const openGroups = input.groups.filter((group) => group.status !== "completed");
  const latest = (periods: Array<string | null>) =>
    periods.reduce<string | null>(
      (last, period) => (period && (!last || period > last) ? period : last),
      null,
    );

  return {
    payoffPeriod: input.payoffPeriod,
    installmentCount: selected.length,
    totalAmount: centsToMoney(totalCents),
    discountAmount: centsToMoney(discountCents),
    discountPercentage: percentageOf(discountCents, totalCents),
    payoffAmount: centsToMoney(payoffCents),
    nextMonthReliefAmount: centsToMoney(
      releasedCentsByPeriod.get(addMonthsToPeriod(input.payoffPeriod, 1)) ?? 0,
    ),
    lastInstallmentPeriod: {
      current: latest(openGroups.map((group) => group.endPeriod)),
      simulated: latest(
        openGroups.map((group) =>
          simulatedEndBySeries.has(group.seriesId)
            ? (simulatedEndBySeries.get(group.seriesId) ?? null)
            : group.endPeriod,
        ),
      ),
    },
    upcomingMonths,
    series,
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
  const overdueInstallmentCount = pendingInstallments.filter(
    (installment) => installment.period < referencePeriod,
  ).length;
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
    note: representative.note,
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
    overdueInstallmentCount,
    trackedAmount: centsToMoney(trackedAmountCents),
    paidAmount: centsToMoney(paidAmountCents),
    pendingAmount: centsToMoney(pendingAmountCents),
    progressPercentage:
      trackedInstallmentCount > 0
        ? roundToTwoDecimals((paidInstallmentCount / trackedInstallmentCount) * 100)
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
  let overdueCents = 0;
  let trackedCents = 0;
  let paidInstallmentCount = 0;
  let pendingInstallmentCount = 0;
  let trackedInstallmentCount = 0;
  let untrackedInstallmentCount = 0;
  let missingInstallmentCount = 0;
  let lastInstallmentPeriod: string | null = null;

  for (const group of groups) {
    if (
      group.status !== "completed" &&
      group.endPeriod &&
      (!lastInstallmentPeriod || group.endPeriod > lastInstallmentPeriod)
    ) {
      lastInstallmentPeriod = group.endPeriod;
    }
    pendingCents += moneyToCents(group.pendingAmount);
    trackedCents += moneyToCents(group.trackedAmount);
    paidInstallmentCount += group.paidInstallmentCount;
    pendingInstallmentCount += group.pendingInstallmentCount;
    trackedInstallmentCount += group.trackedInstallmentCount;
    untrackedInstallmentCount += group.untrackedInstallmentCount;
    missingInstallmentCount += group.missingInstallmentCount;

    for (const installment of group.installments) {
      if (installment.status !== "pending") continue;
      if (installment.period === referencePeriod) {
        dueInPeriodCents += moneyToCents(installment.amount);
      } else if (installment.period < referencePeriod) {
        overdueCents += moneyToCents(installment.amount);
      }
    }
  }

  return {
    openSeriesCount: groups.filter((group) => group.status !== "completed").length,
    totalPendingAmount: centsToMoney(pendingCents),
    dueInPeriodAmount: centsToMoney(dueInPeriodCents),
    overdueAmount: centsToMoney(overdueCents),
    lastInstallmentPeriod,
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

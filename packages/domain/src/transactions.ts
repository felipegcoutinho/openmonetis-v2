import { type CardClosingRule, getInvoiceDates } from "./cards";

export const transactionTypes = ["income", "expense", "transfer"] as const;
export const transactionOrigins = [
  "regular",
  "invoicePayment",
  "refund",
  "accountBalanceAdjustment",
  "invoiceAdjustment",
  "personSettlement",
] as const;
export const transactionConditions = ["single", "installment", "recurring"] as const;
export const paymentMethods = [
  "credit_card",
  "debit_card",
  "pix",
  "cash",
  "boleto",
  "benefits",
  "bank_transfer",
] as const;
export const recurrenceFrequencies = [
  "weekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "annual",
] as const;

export type TransactionType = (typeof transactionTypes)[number];
export type TransactionOrigin = (typeof transactionOrigins)[number];
export type TransactionCondition = (typeof transactionConditions)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type RecurrenceFrequency = (typeof recurrenceFrequencies)[number];
export type TransactionSplitInput = { personId: string; amount: number };
export type TransactionAllocation = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  amount: number;
};
export type TransferPosting = {
  accountId: string;
  amount: number;
  direction: "outgoing" | "incoming";
};

export class InsufficientTransferBalanceError extends RangeError {
  constructor() {
    super("transfer_amount_exceeds_available_balance");
    this.name = "InsufficientTransferBalanceError";
  }
}
export type TrackedInstallment = {
  currentInstallment: number;
  amount: number;
  period: string;
  dueDate: string | null;
  isSettled: boolean | null;
};

export type RefundCalculation = {
  originalAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  refundAmount: number;
  remainingRefundableAmount: number;
};

export type TransactionSelectionItem = {
  amount: number;
  origin: TransactionOrigin;
  type: TransactionType;
};

export type TransactionSelectionSummary = {
  selectedCount: number;
  inflow: number;
  outflow: number;
  balance: number;
  neutralCount: number;
};

export function isNeutralTransactionSelectionItem(
  item: Pick<TransactionSelectionItem, "origin" | "type">,
) {
  return (
    item.type === "transfer" ||
    item.origin === "accountBalanceAdjustment" ||
    item.origin === "invoicePayment"
  );
}

export function isTransactionSelectionItemSelectable(
  item: Pick<TransactionSelectionItem, "origin" | "type">,
) {
  return !isNeutralTransactionSelectionItem(item);
}

export function summarizeTransactionSelection(
  items: readonly TransactionSelectionItem[],
): TransactionSelectionSummary {
  let inflowCents = 0;
  let outflowCents = 0;
  let neutralCount = 0;

  for (const item of items) {
    if (isNeutralTransactionSelectionItem(item)) {
      neutralCount += 1;
      continue;
    }
    const amountCents = Math.round(item.amount * 100);
    if (amountCents >= 0) inflowCents += amountCents;
    else outflowCents += Math.abs(amountCents);
  }

  return {
    selectedCount: items.length,
    inflow: inflowCents / 100,
    outflow: outflowCents / 100,
    balance: (inflowCents - outflowCents) / 100,
    neutralCount,
  };
}

export function canDeleteTransactionOrigin(origin: TransactionOrigin) {
  return origin === "regular" || origin === "refund" || origin === "accountBalanceAdjustment";
}

export function isExpenseReduction(input: {
  amount: number | string;
  origin: TransactionOrigin;
  type: TransactionType;
}) {
  return (
    (input.origin === "refund" && input.type === "income") ||
    (input.origin === "invoiceAdjustment" && Number(input.amount) > 0)
  );
}

export function calculateExpenseImpact(input: {
  amount: number | string;
  origin: TransactionOrigin;
  type: TransactionType;
}) {
  const amount = Math.abs(Number(input.amount));
  if (!Number.isFinite(amount)) return 0;
  if (isExpenseReduction(input)) return -amount;
  return input.type === "expense" ? amount : 0;
}

export type ImportedTransaction = {
  externalId: string | null;
  purchaseDate: string;
  amount: number;
  name: string;
  type: "income" | "expense";
  categoryName: string | null;
};

export type ImportedStatement = {
  sourceName: string;
  sourceReference: string;
  accountNumber: string | null;
  period: { from: string; to: string } | null;
  isCreditCard: boolean;
  transactions: ImportedTransaction[];
};

const frequencyMonths: Partial<Record<RecurrenceFrequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function normalizeTransactionAmount(type: TransactionType, amount: number) {
  const absolute = Math.abs(amount);
  return type === "expense" ? -absolute : absolute;
}

export function projectTransactionAllocations(input: {
  id: string;
  amount: number;
  splitShares: Array<Omit<TransactionAllocation, "amount"> & { amount: number }>;
}): Array<{ id: string; allocation: TransactionAllocation | null }> {
  if (input.splitShares.length === 0) {
    return [{ id: input.id, allocation: null }];
  }

  const direction = input.amount < 0 ? -1 : 1;
  return input.splitShares.map((share) => ({
    id: `${input.id}:${share.personId}`,
    allocation: {
      ...share,
      amount: direction * Math.abs(share.amount),
    },
  }));
}

export function calculateRefund(input: {
  originalAmount: string | number;
  previousRefunds: Array<string | number>;
  refundAmount: number;
}): RefundCalculation {
  const originalCents = toPositiveCents(input.originalAmount);
  const refundedCents = input.previousRefunds.reduce<number>(
    (total, amount) => total + toPositiveCents(amount),
    0,
  );
  const refundCents = toPositiveCents(input.refundAmount);
  const refundableCents = Math.max(0, originalCents - refundedCents);

  if (originalCents === 0) throw new RangeError("original_amount_required");
  if (refundCents === 0) throw new RangeError("refund_amount_required");
  if (refundCents > refundableCents) throw new RangeError("refund_exceeds_available_amount");

  return {
    originalAmount: originalCents / 100,
    refundedAmount: refundedCents / 100,
    refundableAmount: refundableCents / 100,
    refundAmount: refundCents / 100,
    remainingRefundableAmount: (refundableCents - refundCents) / 100,
  };
}

export function allocateRefundByResponsibility(
  refundAmount: number,
  primaryPersonId: string,
  splitShares: Array<{ personId: string; amount: string | number }>,
) {
  const refundCents = toPositiveCents(refundAmount);
  const shares = splitShares.length
    ? splitShares
    : [{ personId: primaryPersonId, amount: refundAmount }];
  const totalWeight = shares.reduce((total, share) => total + toPositiveCents(share.amount), 0);
  if (totalWeight === 0) throw new RangeError("refund_responsibility_required");

  let allocated = 0;
  return shares.map((share, index) => {
    const amount =
      index === shares.length - 1
        ? refundCents - allocated
        : Math.floor((refundCents * toPositiveCents(share.amount)) / totalWeight);
    allocated += amount;
    return { personId: share.personId, amount: amount / 100 };
  });
}

function toPositiveCents(value: string | number) {
  const amount = Math.abs(Number(value));
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0;
}

export function parseOfxStatement(content: string): ImportedStatement {
  const normalized = content.replace(/^\uFEFF/, "");
  const ofxStart = normalized.search(/<OFX>/i);
  const body = ofxStart >= 0 ? normalized.slice(ofxStart) : normalized;
  const sourceName = decodeOfxText(readOfxField(body, "ORG") ?? "Instituição financeira");
  const bankId = readOfxField(body, "BANKID") ?? readOfxField(body, "FID") ?? "unknown";
  const accountNumber = readOfxField(body, "ACCTID");
  const isCreditCard = /<(CREDITCARDMSGSRSV1|CCSTMTRS)>/i.test(body);
  const sourceReference = `${isCreditCard ? "card" : "account"}:${sourceName}:${bankId}:${accountNumber ?? "unknown"}`;
  const from = parseOfxDate(readOfxField(body, "DTSTART"));
  const to = parseOfxDate(readOfxField(body, "DTEND"));
  const transactionBlocks = body.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions = transactionBlocks.flatMap<ImportedTransaction>((block) => {
    const purchaseDate = parseOfxDate(readOfxField(block, "DTPOSTED"));
    const rawAmount = readOfxField(block, "TRNAMT");
    const amount = rawAmount ? Number.parseFloat(rawAmount.replace(",", ".")) : Number.NaN;
    const rawName = readOfxField(block, "MEMO") ?? readOfxField(block, "NAME") ?? "";
    const name = decodeOfxText(rawName).replace(/\s+/g, " ").trim();

    if (!purchaseDate || !Number.isFinite(amount) || amount === 0 || !name) return [];

    return [
      {
        externalId: readOfxField(block, "FITID")?.slice(0, 255) ?? null,
        purchaseDate,
        amount: Math.abs(amount),
        name: name.slice(0, 160),
        type: amount > 0 ? "income" : "expense",
        categoryName: null,
      },
    ];
  });

  if (!transactions.length) throw new Error("No valid transactions found in OFX statement");

  return {
    sourceName,
    sourceReference,
    accountNumber: maskAccountNumber(accountNumber),
    period: from && to ? { from, to } : deriveImportedPeriod(transactions),
    isCreditCard,
    transactions,
  };
}

export function deriveImportedPeriod(transactions: ImportedTransaction[]) {
  if (!transactions.length) return null;
  const dates = transactions.map((transaction) => transaction.purchaseDate).sort();
  return { from: dates[0] as string, to: dates.at(-1) as string };
}

export function normalizeImportedAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.abs(value) : null;
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[^\d,.-]/g, "");
  if (!compact) return null;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const normalized = compact
    .replace(decimalSeparator === "," ? /\./g : /,/g, "")
    .replace(decimalSeparator, ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : null;
}

export function normalizeImportedType(value: unknown, signedAmount?: number) {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  if (["receita", "income", "crédito", "credito", "credit"].includes(normalized))
    return "income" as const;
  if (["despesa", "expense", "débito", "debito", "debit"].includes(normalized))
    return "expense" as const;
  return signedAmount !== undefined && signedAmount > 0
    ? ("income" as const)
    : ("expense" as const);
}

export function normalizeImportedDescriptionKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function readOfxField(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match?.[1]?.trim() || null;
}

function parseOfxDate(value: string | null) {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) ? null : date;
}

function decodeOfxText(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function maskAccountNumber(value: string | null) {
  if (!value) return null;
  const visible = value.slice(-4);
  return visible.length === value.length ? visible : `•••• ${visible}`;
}

export function buildTransferPostings(input: {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
}): [TransferPosting, TransferPosting] {
  if (!input.sourceAccountId || !input.destinationAccountId) {
    throw new Error("Transfer accounts are required");
  }
  if (input.sourceAccountId === input.destinationAccountId) {
    throw new Error("Transfer accounts must be different");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new RangeError("Transfer amount must be greater than zero");
  }

  const amount = Math.abs(input.amount);
  return [
    { accountId: input.sourceAccountId, amount: -amount, direction: "outgoing" },
    { accountId: input.destinationAccountId, amount, direction: "incoming" },
  ];
}

export function assertTransferWithinAvailableBalance(input: {
  amount: number;
  availableBalance: number;
}) {
  const amountCents = toPositiveCents(input.amount);
  const availableBalanceCents = Math.round(Number(input.availableBalance) * 100);

  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !Number.isFinite(input.availableBalance) ||
    amountCents > availableBalanceCents
  ) {
    throw new InsufficientTransferBalanceError();
  }
}

export function toDisplayAmount(amount: string | number) {
  return Math.abs(Number(amount));
}

export function getPeriodFromDate(value: string | Date) {
  const date = value instanceof Date ? value : parseDate(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addMonthsToPeriod(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  return getPeriodFromDate(createUtcDate(year, month - 1 + months, 1));
}

export function getPeriodEndDate(period: string) {
  const [year, month] = period.split("-").map(Number);
  return createUtcDate(year, month, 0);
}

export function addMonthsToDate(value: string, months: number) {
  return toDateString(addMonths(parseDate(value), months));
}

export function calculateInstallmentEndPeriod(input: {
  installmentPeriod: string;
  currentInstallment: number;
  totalInstallments: number;
}) {
  if (
    !Number.isInteger(input.currentInstallment) ||
    !Number.isInteger(input.totalInstallments) ||
    input.currentInstallment < 1 ||
    input.totalInstallments < 2 ||
    input.currentInstallment > input.totalInstallments
  ) {
    throw new RangeError("installment position must be within the complete series");
  }

  return addMonthsToPeriod(
    input.installmentPeriod,
    input.totalInstallments - input.currentInstallment,
  );
}

export function deriveTransactionPeriod(input: {
  paymentMethod: PaymentMethod;
  purchaseDate: string;
  dueDate?: string | null;
  card?: { closingDay: number | null; closingRule?: CardClosingRule; dueDay: number } | null;
}) {
  if (input.paymentMethod === "credit_card" && input.card) {
    const purchasePeriod = getPeriodFromDate(input.purchaseDate);
    for (const offset of [-1, 0, 1, 2]) {
      const candidatePeriod = addMonthsToPeriod(purchasePeriod, offset);
      const { closingDate } = getInvoiceDates({
        period: candidatePeriod,
        closingDay: input.card.closingDay,
        closingRule: input.card.closingRule,
        dueDay: input.card.dueDay,
      });
      if (input.purchaseDate <= closingDate) return candidatePeriod;
    }
    return addMonthsToPeriod(purchasePeriod, 2);
  }
  if (input.paymentMethod === "boleto" && input.dueDate) return getPeriodFromDate(input.dueDate);
  return getPeriodFromDate(input.purchaseDate);
}

export function deriveTransactionPostingPeriod(input: {
  period: string;
  paymentMethod: PaymentMethod | null;
  boletoPaymentDate?: string | null;
}) {
  if (input.paymentMethod === "boleto" && input.boletoPaymentDate) {
    return getPeriodFromDate(input.boletoPaymentDate);
  }

  return input.period;
}

export function deriveTransactionCompetencePeriod(input: {
  paymentMethod: PaymentMethod | null;
  period: string;
  purchaseDate: string;
}) {
  if (input.paymentMethod === "boleto") return getPeriodFromDate(input.purchaseDate);

  return input.period;
}

export function deriveTransactionForecastPeriod(input: {
  dueDate?: string | null;
  isSettled: boolean;
  paymentMethod: PaymentMethod | null;
  period: string;
}) {
  if (input.isSettled) return null;
  if (input.paymentMethod === "boleto" && input.dueDate) {
    return getPeriodFromDate(input.dueDate);
  }

  return input.period;
}

export function splitAmountEqually(amount: number, count: number) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("count must be a positive integer");
  }

  const cents = Math.round(Math.abs(amount) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function allocateAmountByPercentages(totalAmount: number, percentages: number[]) {
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  const basisPoints = percentages.map((percentage) => {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new RangeError("percentages must be between zero and one hundred");
    }
    return Math.round(percentage * 100);
  });

  return allocateProportionalUnits(totalCents, basisPoints, 10_000).map(
    (amountCents) => amountCents / 100,
  );
}

export function calculatePercentageShares(totalAmount: number, amounts: Array<string | number>) {
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  if (totalCents <= 0) throw new RangeError("total amount must be greater than zero");

  const amountCents = amounts.map((amount) => {
    const cents = Math.round(Math.abs(Number(amount)) * 100);
    if (!Number.isFinite(cents)) throw new RangeError("amounts must be finite numbers");
    return cents;
  });

  return allocateProportionalUnits(10_000, amountCents, totalCents).map(
    (basisPoints) => basisPoints / 100,
  );
}

export function allocateAmountProportionally(totalAmount: number, weights: Array<string | number>) {
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  if (totalCents <= 0) throw new RangeError("total amount must be greater than zero");

  const weightCents = weights.map((weight) => {
    const cents = Math.round(Math.abs(Number(weight)) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new RangeError("allocation weights must be positive finite amounts");
    }
    return cents;
  });
  if (weightCents.length < 2) {
    throw new RangeError("proportional allocation requires at least two weights");
  }

  const weightTotal = weightCents.reduce((sum, weight) => sum + weight, 0);
  const allocations = allocateProportionalUnits(totalCents, weightCents, weightTotal);
  if (allocations.some((amount) => amount <= 0)) {
    throw new RangeError("total amount is too small for every allocation");
  }

  return allocations.map((amount) => amount / 100);
}

/**
 * Allocates each installment between people while preserving both margins:
 * every row matches its transaction amount and every column matches the person's
 * total share for the complete series.
 */
export function allocateInstallmentShares(
  installmentAmounts: Array<string | number>,
  shareAmounts: Array<string | number>,
) {
  if (!installmentAmounts.length || shareAmounts.length < 2) {
    throw new RangeError("installments and at least two shares are required");
  }

  const installmentCents = installmentAmounts.map((amount) => {
    const cents = Math.round(Math.abs(Number(amount)) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new RangeError("installment amounts must be positive finite amounts");
    }
    return cents;
  });
  const remainingShareCents = shareAmounts.map((amount) => {
    const cents = Math.round(Math.abs(Number(amount)) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new RangeError("share amounts must be positive finite amounts");
    }
    return cents;
  });
  const installmentTotal = installmentCents.reduce((sum, amount) => sum + amount, 0);
  const shareTotal = remainingShareCents.reduce((sum, amount) => sum + amount, 0);
  if (installmentTotal !== shareTotal) {
    throw new RangeError("installment and share totals must match");
  }

  let remainingTotal = installmentTotal;
  return installmentCents.map((installment, installmentIndex) => {
    const isLast = installmentIndex === installmentCents.length - 1;
    const allocations = isLast
      ? [...remainingShareCents]
      : allocateProportionalUnits(installment, remainingShareCents, remainingTotal);
    if (
      allocations.some((allocation, shareIndex) => {
        const remainingShare = remainingShareCents[shareIndex];
        return remainingShare === undefined || allocation <= 0 || allocation > remainingShare;
      })
    ) {
      throw new RangeError("an installment is too small for every share");
    }
    allocations.forEach((allocation, shareIndex) => {
      const remainingShare = remainingShareCents[shareIndex];
      if (remainingShare === undefined) throw new RangeError("share allocation is missing");
      remainingShareCents[shareIndex] = remainingShare - allocation;
    });
    remainingTotal -= installment;
    return allocations.map((allocation) => allocation / 100);
  });
}

export function rebalanceAmountShare(
  totalAmount: number,
  amounts: Array<string | number>,
  targetIndex: number,
) {
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  const amountCents = amounts.map((amount) => {
    const cents = Math.round(Math.abs(Number(amount)) * 100);
    if (!Number.isFinite(cents)) throw new RangeError("amounts must be finite numbers");
    return cents;
  });
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= amountCents.length) {
    throw new RangeError("target index must identify an amount share");
  }

  const otherCents = amountCents.reduce(
    (sum, amount, index) => sum + (index === targetIndex ? 0 : amount),
    0,
  );
  return amountCents.map((amount, index) =>
    index === targetIndex ? Math.max(1, totalCents - otherCents) / 100 : amount / 100,
  );
}

export function rebalancePercentageShare(percentages: number[], targetIndex: number) {
  const basisPoints = percentages.map((percentage) => {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new RangeError("percentages must be between zero and one hundred");
    }
    return Math.round(percentage * 100);
  });
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= basisPoints.length) {
    throw new RangeError("target index must identify a percentage share");
  }

  const otherBasisPoints = basisPoints.reduce(
    (sum, percentage, index) => sum + (index === targetIndex ? 0 : percentage),
    0,
  );
  return basisPoints.map((percentage, index) =>
    index === targetIndex ? Math.max(1, 10_000 - otherBasisPoints) / 100 : percentage / 100,
  );
}

function allocateProportionalUnits(totalUnits: number, weights: number[], denominator: number) {
  if (!Number.isSafeInteger(totalUnits) || totalUnits < 0 || denominator <= 0) {
    throw new RangeError("proportional allocation requires valid units and denominator");
  }
  if (weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0)) {
    throw new RangeError("proportional weights must be safe non-negative integers");
  }

  const exactTotal = weights.reduce((sum, weight) => sum + weight, 0) === denominator;
  if (!exactTotal) {
    return weights.map((weight) => {
      const scaled = totalUnits * weight;
      if (!Number.isSafeInteger(scaled)) {
        throw new RangeError("proportional allocation exceeds safe integer precision");
      }
      return Math.round(scaled / denominator);
    });
  }

  const allocations = weights.map((weight, index) => {
    const scaled = totalUnits * weight;
    if (!Number.isSafeInteger(scaled)) {
      throw new RangeError("proportional allocation exceeds safe integer precision");
    }
    return {
      index,
      units: Math.floor(scaled / denominator),
      remainder: scaled % denominator,
    };
  });
  const remaining = totalUnits - allocations.reduce((sum, allocation) => sum + allocation.units, 0);
  const priority = [...allocations].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  );
  for (let index = 0; index < remaining; index += 1) {
    const allocation = priority[index % priority.length] as (typeof priority)[number];
    allocation.units += 1;
  }

  return allocations.map((allocation) => allocation.units);
}

export function splitAmountIntoInstallments(amount: number, count: number) {
  return splitAmountEqually(amount, count);
}

/**
 * Builds only the part of an installment series that will be tracked by the API.
 * The amount is always split across the complete series first, so starting midway
 * never redistributes cents that belonged to earlier installments.
 */
export function buildTrackedInstallmentSchedule(input: {
  totalAmount: number;
  installmentCount: number;
  startInstallment: number;
  trackedAmounts?: Array<string | number>;
  basePeriod: string;
  dueDate?: string | null;
  paymentMethod: PaymentMethod;
  initialSettlement?: boolean | null;
}): TrackedInstallment[] {
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 2) {
    throw new RangeError("installmentCount must be an integer greater than one");
  }
  if (
    !Number.isInteger(input.startInstallment) ||
    input.startInstallment < 1 ||
    input.startInstallment > input.installmentCount
  ) {
    throw new RangeError("startInstallment must be within the installment series");
  }

  const expectedTrackedCount = input.installmentCount - input.startInstallment + 1;
  const trackedAmounts = input.trackedAmounts
    ? input.trackedAmounts.map((amount) => Math.round(Math.abs(Number(amount)) * 100) / 100)
    : splitAmountIntoInstallments(input.totalAmount, input.installmentCount).slice(
        input.startInstallment - 1,
      );
  if (
    trackedAmounts.length !== expectedTrackedCount ||
    trackedAmounts.some((amount) => !Number.isFinite(amount) || amount <= 0)
  ) {
    throw new RangeError("tracked installment amounts do not match the series");
  }
  const totalCents = Math.round(Math.abs(input.totalAmount) * 100);
  const trackedCents = trackedAmounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  if (
    (input.startInstallment === 1 && trackedCents !== totalCents) ||
    (input.startInstallment > 1 && trackedCents > totalCents)
  ) {
    throw new RangeError("tracked installment amounts do not match the total");
  }

  return trackedAmounts.map((amount, trackedIndex) => ({
    currentInstallment: input.startInstallment + trackedIndex,
    amount,
    period: addMonthsToPeriod(input.basePeriod, trackedIndex),
    dueDate: input.dueDate ? toDateString(addMonths(parseDate(input.dueDate), trackedIndex)) : null,
    isSettled:
      input.paymentMethod === "credit_card"
        ? null
        : trackedIndex === 0
          ? (input.initialSettlement ?? false)
          : false,
  }));
}

export function validateTransactionSplits(totalAmount: number, splits: TransactionSplitInput[]) {
  if (splits.length < 2) return false;
  if (new Set(splits.map((split) => split.personId)).size !== splits.length) return false;
  if (splits.some((split) => !Number.isFinite(split.amount) || split.amount <= 0)) return false;
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  const splitCents = splits.reduce((sum, split) => sum + Math.round(split.amount * 100), 0);
  return totalCents === splitCents;
}

export type TransactionSplitAllocationAnalysis = {
  allocatedCents: number;
  allocationExceeded: boolean;
  amountCents: number[];
  canSave: boolean;
  differenceCents: number;
  differenceIsMissing: boolean;
  distributedPercentage: number;
  hasAllocationDifference: boolean;
  hasAllocationIssue: boolean;
  hasInvalidAllocation: boolean;
  percentageBasisPoints: number;
  percentageDifferenceBasisPoints: number;
};

export function analyzeTransactionSplitAllocation(input: {
  amounts: Array<string | number>;
  mode: "amount" | "percentage";
  percentages?: Array<string | number>;
  totalAmount: string | number;
}): TransactionSplitAllocationAnalysis {
  const total = Number(input.totalAmount);
  const totalCents = Number.isFinite(total) ? Math.round(total * 100) : 0;
  const amountCents = input.amounts.map((amount) => {
    const value = Number(amount);
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  });
  const allocatedCents = amountCents.reduce((sum, amount) => sum + amount, 0);
  const differenceCents = totalCents - allocatedCents;
  const percentages = (input.percentages ?? []).map((percentage) => Number(percentage));
  const percentageBasisPoints = percentages.reduce(
    (sum, percentage) => sum + (Number.isFinite(percentage) ? Math.round(percentage * 100) : 0),
    0,
  );
  const percentageDifferenceBasisPoints = 10_000 - percentageBasisPoints;
  const hasInvalidAmount = amountCents.some((amount) => amount <= 0);
  const hasInvalidPercentage = percentages.some(
    (percentage) => !Number.isFinite(percentage) || percentage <= 0 || percentage > 100,
  );
  const hasAllocationDifference =
    input.mode === "percentage" ? percentageDifferenceBasisPoints !== 0 : differenceCents !== 0;
  const hasInvalidAllocation =
    input.mode === "percentage" ? hasInvalidPercentage : hasInvalidAmount;
  const hasEnoughShares = input.amounts.length >= 2;

  return {
    allocatedCents,
    allocationExceeded:
      input.mode === "percentage" ? percentageDifferenceBasisPoints < 0 : differenceCents < 0,
    amountCents,
    canSave:
      hasEnoughShares &&
      !hasAllocationDifference &&
      !hasInvalidAllocation &&
      allocatedCents === totalCents,
    differenceCents,
    differenceIsMissing:
      input.mode === "percentage" ? percentageDifferenceBasisPoints > 0 : differenceCents > 0,
    distributedPercentage:
      input.mode === "percentage"
        ? Math.min(100, Math.max(0, percentageBasisPoints / 100))
        : totalCents > 0
          ? Math.min(100, Math.max(0, (allocatedCents / totalCents) * 100))
          : 0,
    hasAllocationDifference,
    hasAllocationIssue: hasEnoughShares && (hasAllocationDifference || hasInvalidAllocation),
    hasInvalidAllocation,
    percentageBasisPoints,
    percentageDifferenceBasisPoints,
  };
}

export function listRecurrenceDatesInPeriod(input: {
  anchorDate?: string;
  endDate?: string | null;
  startDate: string;
  frequency: RecurrenceFrequency;
  period: string;
}) {
  const anchor = parseDate(input.anchorDate ?? input.startDate);
  const start = parseDate(input.startDate);
  const periodStart = parseDate(`${input.period}-01`);
  const periodEnd = createUtcDate(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0);
  if (start > periodEnd) return [];
  const effectiveStart = start > periodStart ? start : periodStart;
  const dates: string[] = [];
  if (input.frequency === "weekly") {
    const step = 7;
    let current = anchor;
    if (current < effectiveStart) {
      const elapsed = Math.floor((effectiveStart.getTime() - current.getTime()) / 86_400_000);
      current = addDays(current, Math.ceil(elapsed / step) * step);
    }
    while (current <= periodEnd) {
      const date = toDateString(current);
      if (input.endDate === null || input.endDate === undefined || date <= input.endDate) {
        dates.push(date);
      }
      current = addDays(current, step);
    }
    return dates;
  }
  const interval = frequencyMonths[input.frequency] as number;
  let occurrence = 0;
  let current = anchor;
  while (current < effectiveStart) {
    occurrence += 1;
    current = addMonths(anchor, interval * occurrence);
  }
  while (current <= periodEnd) {
    const date = toDateString(current);
    if (input.endDate === null || input.endDate === undefined || date <= input.endDate) {
      dates.push(date);
    }
    occurrence += 1;
    current = addMonths(anchor, interval * occurrence);
  }
  return dates;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}
function createUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}
function addDays(date: Date, days: number) {
  return createUtcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
}
function addMonths(date: Date, months: number) {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    clampDay(date.getUTCDate(), date.getUTCFullYear(), date.getUTCMonth() + months),
  );
}
function clampDay(day: number, year: number, month: number) {
  return Math.min(day, createUtcDate(year, month + 1, 0).getUTCDate());
}

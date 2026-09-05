export const accountTypes = [
  "checking",
  "savings",
  "investment",
  "cash",
  "benefits",
  "other",
] as const;

export type AccountType = (typeof accountTypes)[number];

export type AccountBalancePosting = {
  period: string;
  amount: number;
  includeInSummary?: boolean;
};

export type AccountPeriodSummary = {
  period: string;
  income: number;
  expenses: number;
  balance: number;
};

export type AccountCreateDraft = {
  userId: string;
  name: string;
  type: AccountType;
  logo: string | null;
  note: string | null;
  excludeFromBalance: boolean;
};

export type AccountBalanceAdjustmentDraft = {
  amount: string;
  type: "expense" | "income";
};

export type AccountYieldInput =
  | { mode: "amount"; amount: number }
  | { mode: "currentBalance"; balance: number };

export type AccountYieldDraft = {
  amount: string;
  previousBalance: number;
  currentBalance: number;
};

export function createAccountDraft(input: AccountCreateDraft): AccountCreateDraft {
  return {
    ...input,
    name: input.name.trim(),
    logo: input.logo?.trim() || null,
    note: input.note?.trim() || null,
  };
}

export function calculateAccountBalanceAdjustment(currentBalance: number, desiredBalance: number) {
  return fromCents(toCents(desiredBalance) - toCents(currentBalance));
}

export function createAccountBalanceAdjustmentDraft(
  currentBalance: number,
  desiredBalance: number,
): AccountBalanceAdjustmentDraft | null {
  const adjustment = calculateAccountBalanceAdjustment(currentBalance, desiredBalance);
  if (adjustment === 0) return null;

  const type = adjustment < 0 ? "expense" : "income";
  return {
    amount: adjustment.toFixed(2),
    type,
  };
}

export function createAccountYieldDraft(
  currentBalance: number,
  input: AccountYieldInput,
): AccountYieldDraft {
  const previousBalanceCents = toCents(currentBalance);
  const yieldCents =
    input.mode === "amount" ? toCents(input.amount) : toCents(input.balance) - previousBalanceCents;

  if (yieldCents <= 0) throw new RangeError("positive_yield_required");

  return {
    amount: fromCents(yieldCents).toFixed(2),
    previousBalance: fromCents(previousBalanceCents),
    currentBalance: fromCents(previousBalanceCents + yieldCents),
  };
}

export function calculateAccountPeriodSummary(input: {
  period: string;
  postings: AccountBalancePosting[];
}): AccountPeriodSummary {
  let balanceCents = 0;
  let incomeCents = 0;
  let expenseCents = 0;

  for (const posting of input.postings) {
    const amountCents = toCents(posting.amount);

    if (posting.period <= input.period) balanceCents += amountCents;
    if (posting.period !== input.period) continue;
    if (posting.includeInSummary === false) continue;
    if (amountCents >= 0) incomeCents += amountCents;
    else expenseCents += Math.abs(amountCents);
  }

  return {
    period: input.period,
    income: fromCents(incomeCents),
    expenses: fromCents(expenseCents),
    balance: fromCents(balanceCents),
  };
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(amount: number) {
  return amount / 100;
}

import { addMonthsToPeriod } from "./transactions";

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

export type AccountCashFlowPosting = AccountBalancePosting & { date: string };

export function calculateAccountCashFlow(input: {
  period: string;
  historyEndPeriod: string;
  postings: AccountCashFlowPosting[];
}) {
  const startDate = `${input.period}-01`;
  const [year, month] = input.period.split("-").map(Number);
  const endDate = new Date(Date.UTC(year as number, month as number, 0)).toISOString().slice(0, 10);
  const dailyCents = new Map<string, { income: number; expenses: number; balanceChange: number }>();
  const monthlyCents = new Map<
    string,
    { income: number; expenses: number; balanceChange: number }
  >();
  let openingBalanceCents = 0;
  let outsideMonthCents = 0;

  for (const posting of input.postings) {
    const amountCents = toCents(posting.amount);
    if (posting.period < input.period) openingBalanceCents += amountCents;
    const month = monthlyCents.get(posting.period) ?? {
      income: 0,
      expenses: 0,
      balanceChange: 0,
    };
    month.balanceChange += amountCents;
    if (posting.includeInSummary !== false) {
      if (amountCents >= 0) month.income += amountCents;
      else month.expenses -= amountCents;
    }
    monthlyCents.set(posting.period, month);

    if (posting.period !== input.period) continue;
    if (!posting.date.startsWith(`${input.period}-`)) {
      outsideMonthCents += amountCents;
      continue;
    }
    const date = posting.date;
    const day = dailyCents.get(date) ?? { income: 0, expenses: 0, balanceChange: 0 };
    day.balanceChange += amountCents;
    if (posting.includeInSummary !== false) {
      if (amountCents >= 0) day.income += amountCents;
      else day.expenses -= amountCents;
    }
    dailyCents.set(date, day);
  }

  openingBalanceCents += outsideMonthCents;
  let dailyBalanceCents = openingBalanceCents;
  const daily: { date: string; income: number; expenses: number; balance: number }[] = [];
  for (let day = 1; day <= Number(endDate.slice(-2)); day++) {
    const date = `${input.period}-${String(day).padStart(2, "0")}`;
    const amounts = dailyCents.get(date);
    dailyBalanceCents += amounts?.balanceChange ?? 0;
    daily.push({
      date,
      income: fromCents(amounts?.income ?? 0),
      expenses: fromCents(amounts?.expenses ?? 0),
      balance: fromCents(dailyBalanceCents),
    });
  }

  const firstHistoryPeriod = addMonthsToPeriod(input.historyEndPeriod, -11);
  let historyBalanceCents = [...monthlyCents]
    .filter(([period]) => period < firstHistoryPeriod)
    .reduce((total, [, amounts]) => total + amounts.balanceChange, 0);
  const history = Array.from({ length: 12 }, (_, index) => {
    const period = addMonthsToPeriod(firstHistoryPeriod, index);
    const amounts = monthlyCents.get(period);
    historyBalanceCents += amounts?.balanceChange ?? 0;
    return {
      period,
      income: fromCents(amounts?.income ?? 0),
      expenses: fromCents(amounts?.expenses ?? 0),
      balance: fromCents(historyBalanceCents),
    };
  });

  return {
    period: input.period,
    startDate,
    endDate,
    openingBalance: fromCents(openingBalanceCents),
    outsideMonthAmount: fromCents(outsideMonthCents),
    daily,
    history: { endPeriod: input.historyEndPeriod, items: history },
  };
}

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

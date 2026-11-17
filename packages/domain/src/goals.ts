import { fromCents, roundToTwoDecimals, toCents } from "./money";
import { addMonthsToPeriod } from "./transactions";

export const goalStatuses = ["active", "paused", "completed", "archived"] as const;
export type GoalStatus = (typeof goalStatuses)[number];
export const goalTrackingTypes = ["manual", "account"] as const;
export type GoalTrackingType = (typeof goalTrackingTypes)[number];
export const goalPaceStatuses = ["ahead", "onTrack", "behind", "overdue", "achieved"] as const;
export type GoalPaceStatus = (typeof goalPaceStatuses)[number];
export const goalContributionKinds = ["deposit", "withdrawal", "adjustment"] as const;
export type GoalContributionKind = (typeof goalContributionKinds)[number];
export const goalContributionMovements = ["deposit", "withdrawal"] as const;
export type GoalContributionMovement = (typeof goalContributionMovements)[number];
/** Months shown by the contribution history chart, ending in the current month. */
export const goalContributionHistoryMonths = 12;

export type GoalProgress = {
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  paceStatus: GoalPaceStatus | null;
};

export function shouldFreezeLinkedGoalBalance(
  trackingType: GoalTrackingType,
  status: GoalStatus,
  nextStatus: GoalStatus | undefined,
) {
  return (
    shouldReadLinkedGoalBalance(trackingType, status) &&
    nextStatus !== undefined &&
    nextStatus !== "active"
  );
}

export function shouldReadLinkedGoalBalance(trackingType: GoalTrackingType, status: GoalStatus) {
  return trackingType === "account" && status === "active";
}

export function resolveGoalPaceStatus(status: GoalStatus, paceStatus: GoalPaceStatus | null) {
  if (status === "active") return paceStatus;
  if (status === "completed" && paceStatus === "achieved") return paceStatus;
  return null;
}

export function snapshotLinkedGoalBalance(balance: number) {
  return Math.max(0, roundToTwoDecimals(balance)).toFixed(2);
}

export function calculateGoalProgress(input: {
  targetAmount: number;
  currentAmount: number;
  createdDate: string;
  targetDate: string | null;
  today: string;
}): GoalProgress {
  const target = roundToTwoDecimals(input.targetAmount);
  const currentAmount = Math.max(0, roundToTwoDecimals(input.currentAmount));
  const remainingAmount = roundToTwoDecimals(Math.max(0, target - currentAmount));
  const progressPercentage = Math.round((currentAmount / target) * 1000) / 10;

  if (currentAmount >= target) {
    return { currentAmount, remainingAmount, progressPercentage, paceStatus: "achieved" };
  }
  if (!input.targetDate) {
    return { currentAmount, remainingAmount, progressPercentage, paceStatus: null };
  }
  if (input.targetDate < input.today) {
    return { currentAmount, remainingAmount, progressPercentage, paceStatus: "overdue" };
  }

  const start = Date.parse(`${input.createdDate}T12:00:00Z`);
  const end = Date.parse(`${input.targetDate}T12:00:00Z`);
  const now = Date.parse(`${input.today}T12:00:00Z`);
  const elapsedShare = end <= start ? 1 : Math.min(1, Math.max(0, (now - start) / (end - start)));
  const expectedAmount = target * elapsedShare;
  const paceStatus = currentAmount >= expectedAmount ? "onTrack" : "behind";

  return {
    currentAmount,
    remainingAmount,
    progressPercentage,
    paceStatus: currentAmount > expectedAmount ? "ahead" : paceStatus,
  };
}

export class GoalContributionError extends RangeError {
  constructor(
    readonly code:
      | "goal_contributions_unavailable"
      | "goal_contribution_future_date"
      | "goal_contribution_exceeds_balance",
  ) {
    super(code);
    this.name = "GoalContributionError";
  }
}

/** Only manual goals that are still being pursued keep a contribution history. */
export function canChangeGoalContributions(trackingType: GoalTrackingType, status: GoalStatus) {
  return trackingType === "manual" && (status === "active" || status === "paused");
}

function assertGoalContributionsAvailable(trackingType: GoalTrackingType, status: GoalStatus) {
  if (!canChangeGoalContributions(trackingType, status)) {
    throw new GoalContributionError("goal_contributions_unavailable");
  }
}

export type GoalContributionDraft = {
  kind: GoalContributionKind;
  /** Signed effect on the goal balance, as a database decimal. */
  amount: string;
  date: string;
};

export function createGoalContributionDraft(input: {
  trackingType: GoalTrackingType;
  status: GoalStatus;
  currentAmount: number;
  movement: GoalContributionMovement;
  amount: number;
  date: string;
  today: string;
}): GoalContributionDraft {
  assertGoalContributionsAvailable(input.trackingType, input.status);
  if (input.date > input.today) throw new GoalContributionError("goal_contribution_future_date");
  const amountCents = Math.abs(toCents(input.amount));
  if (input.movement === "withdrawal" && amountCents > toCents(input.currentAmount)) {
    throw new GoalContributionError("goal_contribution_exceeds_balance");
  }
  const signedCents = input.movement === "deposit" ? amountCents : -amountCents;
  return { kind: input.movement, amount: fromCents(signedCents).toFixed(2), date: input.date };
}

/** Editing the saved amount of a manual goal is recorded as an adjustment of the difference. */
export function createGoalBalanceAdjustmentDraft(input: {
  currentAmount: number;
  desiredAmount: number;
  today: string;
}): GoalContributionDraft | null {
  const differenceCents = toCents(input.desiredAmount) - toCents(input.currentAmount);
  if (differenceCents === 0) return null;
  return {
    kind: "adjustment",
    amount: fromCents(differenceCents).toFixed(2),
    date: input.today,
  };
}

export function assertGoalContributionRemovable(input: {
  trackingType: GoalTrackingType;
  status: GoalStatus;
  currentAmount: number;
  contributionAmount: number;
}) {
  assertGoalContributionsAvailable(input.trackingType, input.status);
  if (toCents(input.currentAmount) - toCents(input.contributionAmount) < 0) {
    throw new GoalContributionError("goal_contribution_exceeds_balance");
  }
}

function countMonthsUntil(fromDate: string, toDate: string) {
  const [fromYear, fromMonth] = fromDate.split("-").map(Number) as [number, number];
  const [toYear, toMonth] = toDate.split("-").map(Number) as [number, number];
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/**
 * Monthly amount still needed to reach the target by its date, spread over the months left after
 * the current one (at least one). `null` without a date, after it, or once the target is reached.
 */
export function calculateGoalRequiredMonthlyAmount(input: {
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  today: string;
}) {
  if (!input.targetDate || input.targetDate < input.today) return null;
  const remainingCents = toCents(input.targetAmount) - Math.max(0, toCents(input.currentAmount));
  if (remainingCents <= 0) return null;
  const months = Math.max(1, countMonthsUntil(input.today, input.targetDate));
  return fromCents(Math.ceil(remainingCents / months));
}

export type GoalContributionHistoryEntry = {
  period: string;
  deposits: number;
  withdrawals: number;
  balance: number;
};

/** Month-end balance built from the contributions, for the months that end in `today`. */
export function buildGoalContributionHistory(input: {
  contributions: ReadonlyArray<{ date: string; amount: number }>;
  today: string;
  months?: number;
}): GoalContributionHistoryEntry[] {
  const months = input.months ?? goalContributionHistoryMonths;
  const lastPeriod = input.today.slice(0, 7);
  const firstPeriod = addMonthsToPeriod(lastPeriod, -(months - 1));
  const byPeriod = new Map<string, { deposits: number; withdrawals: number }>();
  let openingCents = 0;

  for (const contribution of input.contributions) {
    const period = contribution.date.slice(0, 7);
    const cents = toCents(contribution.amount);
    if (period < firstPeriod) {
      openingCents += cents;
      continue;
    }
    if (period > lastPeriod) continue;
    const totals = byPeriod.get(period) ?? { deposits: 0, withdrawals: 0 };
    if (cents >= 0) totals.deposits += cents;
    else totals.withdrawals -= cents;
    byPeriod.set(period, totals);
  }

  let balanceCents = openingCents;
  return Array.from({ length: months }, (_, index) => {
    const period = addMonthsToPeriod(firstPeriod, index);
    const totals = byPeriod.get(period) ?? { deposits: 0, withdrawals: 0 };
    balanceCents += totals.deposits - totals.withdrawals;
    return {
      period,
      deposits: fromCents(totals.deposits),
      withdrawals: fromCents(totals.withdrawals),
      balance: fromCents(balanceCents),
    };
  });
}

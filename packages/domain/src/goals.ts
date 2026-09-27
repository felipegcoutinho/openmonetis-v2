export const goalStatuses = ["active", "paused", "completed", "archived"] as const;
export type GoalStatus = (typeof goalStatuses)[number];
export const goalTrackingTypes = ["manual", "account"] as const;
export type GoalTrackingType = (typeof goalTrackingTypes)[number];
export const goalPaceStatuses = ["ahead", "onTrack", "behind", "overdue", "achieved"] as const;
export type GoalPaceStatus = (typeof goalPaceStatuses)[number];

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
  return Math.max(0, roundMoney(balance)).toFixed(2);
}

export function calculateGoalProgress(input: {
  targetAmount: number;
  currentAmount: number;
  createdDate: string;
  targetDate: string | null;
  today: string;
}): GoalProgress {
  const target = roundMoney(input.targetAmount);
  const currentAmount = Math.max(0, roundMoney(input.currentAmount));
  const remainingAmount = roundMoney(Math.max(0, target - currentAmount));
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

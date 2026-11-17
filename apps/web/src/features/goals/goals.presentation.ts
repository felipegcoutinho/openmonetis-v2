import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { GoalContributionOutput, GoalOutput } from "@openmonetis/validators/goals";
import { ApiClientError } from "@/lib/api-client";

export const goalStatusLabels: Record<GoalOutput["status"], string> = {
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  archived: "Arquivada",
};

export const goalPaceLabels: Record<NonNullable<GoalOutput["paceStatus"]>, string> = {
  ahead: "Adiantada",
  onTrack: "No prazo",
  behind: "Abaixo do ritmo",
  overdue: "Prazo vencido",
  achieved: "Valor alcançado",
};

export function formatGoalDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const goalContributionKindLabels: Record<GoalContributionOutput["kind"], string> = {
  deposit: "Aporte",
  withdrawal: "Retirada",
  adjustment: "Ajuste de saldo",
};

/** The oldest adjustment holds the amount the goal started with. */
export function getGoalContributionLabel(
  contribution: Pick<GoalContributionOutput, "kind">,
  isOldest: boolean,
) {
  return contribution.kind === "adjustment" && isOldest
    ? "Saldo inicial"
    : goalContributionKindLabels[contribution.kind];
}

/** Contributions are only recorded on manual goals that are still being pursued. */
export function acceptsGoalContributions(goal: Pick<GoalOutput, "trackingType" | "status">) {
  return goal.trackingType === "manual" && (goal.status === "active" || goal.status === "paused");
}

export function formatGoalShortDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), { day: "2-digit", month: "short" });
}

export function formatGoalHistoryPeriod(period: string, withYear = false) {
  return formatDateInBrazil(periodToSafeInstant(period), {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).replace(".", "");
}

const goalContributionErrorMessages: Record<string, string> = {
  goal_contribution_exceeds_balance: "A retirada é maior que o saldo da meta.",
  goal_contribution_future_date: "Use a data de hoje ou uma data anterior.",
  goal_contributions_unavailable: "Esta meta não aceita aportes.",
  goal_contribution_not_found: "Este registro já foi removido.",
  rate_limited: "Muitas alterações seguidas. Aguarde um instante.",
};

export function getGoalContributionErrorMessage(error: unknown) {
  return (
    (error instanceof ApiClientError && error.code
      ? goalContributionErrorMessages[error.code]
      : undefined) ?? "Não foi possível salvar. Tente novamente."
  );
}

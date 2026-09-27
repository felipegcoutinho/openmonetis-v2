import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { GoalOutput } from "@openmonetis/validators/goals";

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

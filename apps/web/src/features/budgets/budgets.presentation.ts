import { formatDateInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";
import type { BudgetOutput } from "@openmonetis/validators/budgets";

export const budgetStatusLabels: Record<BudgetOutput["status"], string> = {
  onTrack: "Dentro do limite",
  warning: "Atenção",
  reached: "Limite atingido",
  exceeded: "Limite excedido",
};

export const budgetStatusStyles: Record<BudgetOutput["status"], string> = {
  onTrack: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  reached: "bg-warning/10 text-warning",
  exceeded: "bg-destructive/10 text-destructive",
};

export const budgetProgressStyles: Record<BudgetOutput["status"], string> = {
  onTrack: "bg-success",
  warning: "bg-warning",
  reached: "bg-warning",
  exceeded: "bg-destructive",
};

export function formatBudgetPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

export function formatBudgetPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "long",
    year: "numeric",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function getPreviousBudgetPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function getBudgetWidgetItems(items: BudgetOutput[], limit?: number) {
  const sorted = [...items].sort(
    (left, right) =>
      right.usagePercentage - left.usagePercentage ||
      right.committedAmount - left.committedAmount ||
      left.categoryName.localeCompare(right.categoryName, "pt-BR"),
  );

  return limit === undefined ? sorted : sorted.slice(0, limit);
}

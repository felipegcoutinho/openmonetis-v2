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

export function formatBudgetAttention(count: number) {
  return count === 1
    ? "1 categoria está perto ou acima do limite."
    : `${count} categorias estão perto ou acima do limite.`;
}

export function formatBudgetCategoryCount(count: number) {
  return count === 1 ? "1 categoria com limite" : `${count} categorias com limite`;
}

export function formatBudgetPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "long",
    year: "numeric",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
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

function formatBudgetMonthShort(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), { month: "short", year: "numeric" });
}

/** How a budget repeats, said explicitly on its card. */
export function describeBudgetRecurrence(budget: BudgetOutput) {
  if (!budget.recurrence) return "Só neste mês";
  const { startPeriod, endPeriod } = budget.recurrence;
  const range = endPeriod
    ? `de ${formatBudgetMonthShort(startPeriod)} a ${formatBudgetMonthShort(endPeriod)}`
    : `desde ${formatBudgetMonthShort(startPeriod)}`;
  // The adjusted line stays short enough for the card; the range shows up when editing.
  return budget.budgetId ? "Recorrente · ajustado neste mês" : `Todo mês, ${range}`;
}

/** A recurring budget whose month has its own limit. */
export function isAdjustedBudget(budget: BudgetOutput) {
  return budget.recurrence !== null && budget.budgetId !== null;
}

export function getBudgetRuleScopeOptions(period: string) {
  const month = formatBudgetPeriod(period).toLocaleLowerCase("pt-BR");
  return [
    {
      scope: "future" as const,
      label: `De ${month} em diante`,
      description: "Os meses anteriores mantêm o limite que tinham.",
    },
    {
      scope: "single" as const,
      label: `Só em ${month}`,
      description: "Os outros meses continuam com o limite recorrente.",
    },
  ];
}

/**
 * Previous-month limits worth bringing to the current month: one-off ones of categories that have
 * no limit yet. Recurring limits are left out, since they reach the next month by themselves.
 */
export function getCopyableBudgets(previousItems: BudgetOutput[], currentCategoryIds: string[]) {
  const current = new Set(currentCategoryIds);
  return previousItems.filter(
    (budget) =>
      budget.budgetId !== null && budget.recurrence === null && !current.has(budget.categoryId),
  );
}

export function describeCopyableBudgets(count: number, previousPeriod: string) {
  return `${formatBudgetPeriod(previousPeriod)} tem ${
    count === 1 ? "1 limite que não se repete" : `${count} limites que não se repetem`
  }`;
}

import {
  createDefaultDashboardWidgetPreferences,
  type DashboardAttentionKind,
  type DashboardWidgetId,
  type DashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import {
  formatDateInBrazil,
  getCurrentHourInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { DashboardAttentionItemOutput } from "@openmonetis/validators/dashboard";

const metricChangePercentFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
  style: "percent",
});

export function getDashboardGreeting(date = new Date()) {
  const hour = getCurrentHourInBrazil(date);
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function formatDashboardDate(date = new Date()) {
  const formatted = formatDateInBrazil(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return `${formatted.charAt(0).toLocaleUpperCase("pt-BR")}${formatted.slice(1)}`;
}

export function formatMetricChangePercent(percent: number) {
  return metricChangePercentFormatter.format(percent / 100);
}

export function formatProjectedMetricHelp(period: string) {
  const formattedPeriod = formatDashboardPeriod(period).toLocaleLowerCase("pt-BR");

  return `Saldo das contas consideradas, incluindo somente entradas e saídas ainda pendentes até o fim de ${formattedPeriod}.`;
}

export function getAccountBalanceShare(balance: number, totalMagnitude: number) {
  if (totalMagnitude <= 0) return 0;
  return Math.min(100, (Math.abs(balance) / totalMagnitude) * 100);
}

export function formatAccountBalanceShare(share: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(share);
}

export function getPaymentStatusPercentage(confirmed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (confirmed / total) * 100));
}

export function formatDashboardPeriod(period: string, compact = false) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;

  const formatted = formatDateInBrazil(periodToSafeInstant(period), {
    month: compact ? "short" : "long",
    ...(compact ? {} : { year: "numeric" }),
  });

  const normalized = formatted.replace(".", "");
  return compact
    ? normalized.toLocaleLowerCase("pt-BR")
    : `${normalized.charAt(0).toLocaleUpperCase("pt-BR")}${normalized.slice(1)}`;
}

export function formatExpenseDistributionPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDashboardTransactionCount(count: number) {
  return `${count} ${count === 1 ? "lançamento" : "lançamentos"}`;
}

/**
 * Moves a widget to the position of another one, its neighbour inside the same section. Moving
 * forward lands after the target and moving back lands before it, so swapping two neighbours
 * behaves the same either way.
 */
export function moveDashboardWidget(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
  targetWidgetId: DashboardWidgetId,
): DashboardWidgetPreferences {
  const currentIndex = preferences.order.indexOf(widgetId);
  const targetIndex = preferences.order.indexOf(targetWidgetId);
  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) return preferences;

  const order = preferences.order.filter((id) => id !== widgetId);
  const insertionIndex = order.indexOf(targetWidgetId) + (currentIndex < targetIndex ? 1 : 0);
  order.splice(insertionIndex, 0, widgetId);
  return { ...preferences, order };
}

export function hideDashboardWidget(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
): DashboardWidgetPreferences {
  if (preferences.hidden.includes(widgetId)) return preferences;
  return { ...preferences, hidden: [...preferences.hidden, widgetId] };
}

/**
 * Shows a hidden widget at the end of its section, right after the last visible widget of the
 * same section, so it appears where the person asked for it instead of its old position.
 */
export function showDashboardWidget(
  preferences: DashboardWidgetPreferences,
  widgetId: DashboardWidgetId,
  sectionWidgetIds: readonly DashboardWidgetId[],
): DashboardWidgetPreferences {
  if (!preferences.hidden.includes(widgetId)) return preferences;

  const hidden = preferences.hidden.filter((id) => id !== widgetId);
  const order = preferences.order.filter((id) => id !== widgetId);
  const lastVisibleIndex = order.reduce(
    (lastIndex, id, index) =>
      sectionWidgetIds.includes(id) && !hidden.includes(id) ? index : lastIndex,
    -1,
  );
  if (lastVisibleIndex < 0) return { ...preferences, hidden };

  order.splice(lastVisibleIndex + 1, 0, widgetId);
  return { hidden, order };
}

export function areDashboardWidgetPreferencesEqual(
  left: DashboardWidgetPreferences,
  right: DashboardWidgetPreferences,
) {
  return (
    left.order.length === right.order.length &&
    left.hidden.length === right.hidden.length &&
    left.order.every((widgetId, index) => widgetId === right.order[index]) &&
    left.hidden.every((widgetId) => right.hidden.includes(widgetId))
  );
}

const attentionKindLabels: Record<DashboardAttentionKind, string> = {
  invoice: "Fatura",
  bill: "Conta a pagar",
  budget: "Orçamento",
  inbox: "Caixa de entrada",
};

const budgetStatusLabels = {
  warning: "Orçamento perto do limite",
  reached: "Orçamento no limite",
  exceeded: "Orçamento estourado",
} as const;

export function getAttentionKindLabel(item: DashboardAttentionItemOutput) {
  if (item.kind === "invoice" && item.daysUntilDue !== null && item.daysUntilDue < 0) {
    return "Fatura vencida";
  }
  if (item.kind === "bill" && item.daysUntilDue !== null && item.daysUntilDue < 0) {
    return "Conta vencida";
  }
  if (item.kind === "budget" && item.budgetStatus) return budgetStatusLabels[item.budgetStatus];
  return attentionKindLabels[item.kind];
}

export function getAttentionTitle(item: DashboardAttentionItemOutput) {
  if (item.kind === "inbox") {
    return item.count === 1 ? "1 captura" : `${item.count ?? 0} capturas`;
  }
  return item.title ?? attentionKindLabels[item.kind];
}

export function formatAttentionDetail(item: DashboardAttentionItemOutput) {
  if (item.kind === "budget") {
    return item.usagePercentage === null
      ? "Acima do limite"
      : `${item.usagePercentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do limite`;
  }
  if (item.kind === "inbox") return "Aguardando revisão";
  const days = item.daysUntilDue;
  if (days === null) return "";
  if (days < -1) return `Venceu há ${Math.abs(days)} dias`;
  if (days === -1) return "Venceu ontem";
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

export const attentionActionLabels: Record<DashboardAttentionKind, string> = {
  invoice: "Abrir fatura",
  bill: "Ver contas",
  budget: "Ver orçamento",
  inbox: "Revisar",
};

export function isDefaultDashboardWidgetPreferences(preferences: DashboardWidgetPreferences) {
  return areDashboardWidgetPreferencesEqual(preferences, createDefaultDashboardWidgetPreferences());
}

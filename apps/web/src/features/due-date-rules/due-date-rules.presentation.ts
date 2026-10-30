import type { nationalHolidayIds } from "@openmonetis/domain/business-calendars";
import type { DueDateRule } from "@openmonetis/domain/due-date-rules";
import type { DueDateAdjustmentDetails } from "@openmonetis/validators/due-date-rules";
import { DueDateRulesApiError } from "./due-date-rules.api";
export function dueDateRulesErrorMessage(error: unknown) {
  if (error instanceof DueDateRulesApiError) {
    if (error.code === "DUE_DATE_EXCEPTION_SETTLED")
      return "Desfaça o pagamento antes de alterar o vencimento.";
    if (error.code === "DUE_DATE_EXCEPTION_CUSTOM_DATES")
      return "Esta fatura possui datas personalizadas.";
    if (
      error.code === "DUE_DATE_EXCEPTION_UNSUPPORTED" ||
      error.code === "INVALID_RECURRING_OCCURRENCE"
    )
      return "Este item não permite alterar o ajuste de vencimento.";
    if (error.code === "DUE_DATE_RULE_CONFLICT")
      return "Há regras para os mesmos itens. Revise a abrangência.";
    if (error.code === "DUE_DATE_RULES_STALE")
      return "As regras mudaram. Recarregue a página e tente novamente.";
    if (error.code === "DUE_DATE_RULE_TARGET_UNAVAILABLE")
      return "Um dos itens selecionados não está mais disponível.";
    if (error.code === "DUE_DATE_RULES_EFFECTIVE_DATE")
      return "A data da prévia expirou. Revise as alterações novamente.";
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 429) return "Aguarde um minuto e tente novamente.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}
export function createDueDateRule(): DueDateRule {
  return {
    id: crypto.randomUUID(),
    name: "Contas a pagar",
    target: "payable",
    scope: "all",
    cardIds: [],
    transactionIds: [],
    seriesIds: [],
    adjustment: "next",
    weekends: true,
    holidays: true,
  };
}
export function dueDateRuleSummary(rule: DueDateRule) {
  const target = rule.target === "invoice" ? "Faturas" : "Contas a pagar";
  const action = dueDateAdjustmentLabels[rule.adjustment];
  return `${target} · ${rule.scope === "all" ? "todos" : "itens selecionados"} · ${action}`;
}
export function dueDateRuleSelectionSummary(rule: DueDateRule) {
  const count = rule.cardIds.length + rule.transactionIds.length + rule.seriesIds.length;
  return count === 1 ? "1 item" : `${count} itens`;
}
export function formatRecurringHoliday(monthDay: string) {
  const [month, day] = monthDay.split("-");
  return `${day}/${month}`;
}
export function formatDueDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export const dueDateTargetLabels = { payable: "Contas a pagar", invoice: "Faturas de cartão" };
export const dueDateAdjustmentLabels = {
  next: "Próximo dia útil",
  previous: "Dia útil anterior",
  none: "Manter data original",
};
export const nationalHolidayLabels: Record<(typeof nationalHolidayIds)[number], string> = {
  newYear: "Confraternização Universal",
  tiradentes: "Tiradentes",
  labourDay: "Dia do Trabalho",
  independenceDay: "Independência do Brasil",
  ourLadyOfAparecida: "Nossa Senhora Aparecida",
  allSoulsDay: "Finados",
  republicProclamation: "Proclamação da República",
  blackAwarenessDay: "Dia Nacional de Zumbi e da Consciência Negra",
  christmas: "Natal",
};

export function formatDueDateAdjustmentReasons(adjustment: DueDateAdjustmentDetails) {
  const reasons: string[] = [];
  if (adjustment.reasons.some((reason) => reason.weekend)) reasons.push("fim de semana");
  const holidays = [
    ...new Set(
      adjustment.reasons.flatMap((reason) =>
        reason.nationalHolidayId ? [nationalHolidayLabels[reason.nationalHolidayId]] : [],
      ),
    ),
  ];
  if (holidays.length) reasons.push(`feriado (${holidays.join(", ")})`);
  const additionalDates = adjustment.reasons
    .filter((reason) => reason.additionalHoliday)
    .map((reason) => formatDueDate(reason.date));
  if (additionalDates.length) reasons.push(`feriado adicional (${additionalDates.join(", ")})`);
  const summary = reasons.join(" e ");
  return summary
    ? `${summary[0].toLocaleUpperCase("pt-BR")}${summary.slice(1)}.`
    : "Ajuste para dia útil.";
}

export function formatDueDateChange(original: string, current: string) {
  const sameYear = original.slice(0, 4) === current.slice(0, 4);
  const format = (date: string) =>
    sameYear ? formatDueDate(date).slice(0, 5) : formatDueDate(date);
  return `${format(original)} → ${format(current)}`;
}

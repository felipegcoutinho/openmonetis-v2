import type { InboxRuleConditionField } from "@openmonetis/domain/inbox-rules";
import type {
  InboxRuleCondition,
  InboxRuleSuggestionOutput,
} from "@openmonetis/validators/inbox-rules";
import { formatCurrency } from "../../lib/money-presentation";

export const inboxRuleFieldLabels: Record<InboxRuleConditionField, string> = {
  sourceApp: "Identificador do app",
  sourceAppName: "Nome do app",
  originalTitle: "Título da notificação",
  originalText: "Texto da notificação",
  parsedName: "Nome identificado",
  parsedAmount: "Valor identificado",
};

export const inboxRuleTextOperatorLabels = {
  contains: "contém",
  equals: "é igual a",
  startsWith: "começa com",
  endsWith: "termina com",
} as const;

export const inboxRuleAmountOperatorLabels = {
  equals: "é igual a",
  greaterThan: "é maior que",
  lessThan: "é menor que",
} as const;

export const inboxRuleMatchModeLabels = {
  all: { heading: "Quando todas as condições forem atendidas", connector: "e" },
  any: { heading: "Quando qualquer condição for atendida", connector: "ou" },
} as const;

export const inboxRuleMatchModeOptions = {
  all: "Todas precisam coincidir",
  any: "Basta uma coincidir",
} as const;

export function getInboxRuleConditionParts(condition: InboxRuleCondition) {
  const operator =
    condition.field === "parsedAmount"
      ? inboxRuleAmountOperatorLabels[condition.operator]
      : inboxRuleTextOperatorLabels[condition.operator];
  const value =
    condition.field === "parsedAmount" ? formatCurrency(condition.value) : condition.value;
  return { field: inboxRuleFieldLabels[condition.field], operator, value };
}

export function formatInboxRuleCount(total: number, active: number) {
  if (total === 0) return "Nenhuma regra";
  const rules = total === 1 ? "1 regra" : `${total} regras`;
  const actives = active === 1 ? "1 ativa" : `${active} ativas`;
  return `${rules} · ${actives}`;
}

export function describeInboxRuleSuggestion(suggestion: InboxRuleSuggestionOutput | null) {
  if (!suggestion?.appliedRules.length) return undefined;
  const names = suggestion.appliedRules.map((rule) => rule.name).join(", ");
  return `Alguns campos foram sugeridos pelas regras: ${names}. Revise antes de salvar.`;
}

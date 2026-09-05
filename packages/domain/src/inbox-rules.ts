import { normalizeInboxSingleLine } from "./inbox";

export const inboxRuleNameMaximumLength = 120;
export const inboxRuleConditionValueMaximumLength = 500;
export const inboxRuleMaximumConditions = 5;
export const inboxRulePriorityMinimum = 0;
export const inboxRulePriorityMaximum = 9_999;

export const inboxRuleMatchModes = ["all", "any"] as const;
export type InboxRuleMatchMode = (typeof inboxRuleMatchModes)[number];

export const inboxRuleTextConditionFields = [
  "sourceApp",
  "sourceAppName",
  "originalTitle",
  "originalText",
  "parsedName",
] as const;
export const inboxRuleNumericConditionFields = ["parsedAmount"] as const;
export const inboxRuleConditionFields = [
  ...inboxRuleTextConditionFields,
  ...inboxRuleNumericConditionFields,
] as const;
export type InboxRuleConditionField = (typeof inboxRuleConditionFields)[number];
export type InboxRuleTextConditionField = (typeof inboxRuleTextConditionFields)[number];

export const inboxRuleTextConditionOperators = [
  "contains",
  "equals",
  "startsWith",
  "endsWith",
] as const;
export const inboxRuleNumericConditionOperators = ["equals", "greaterThan", "lessThan"] as const;
export type InboxRuleTextConditionOperator = (typeof inboxRuleTextConditionOperators)[number];
export type InboxRuleNumericConditionOperator = (typeof inboxRuleNumericConditionOperators)[number];

export type InboxRuleCondition =
  | {
      field: InboxRuleTextConditionField;
      operator: InboxRuleTextConditionOperator;
      value: string;
    }
  | {
      field: "parsedAmount";
      operator: InboxRuleNumericConditionOperator;
      value: number;
    };

export type InboxRuleDraftInput = {
  userId: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchMode: InboxRuleMatchMode;
  conditions: InboxRuleCondition[];
  categoryId: string | null;
  personId: string | null;
};

export type InboxRuleCandidate = Omit<InboxRuleDraftInput, "userId"> & {
  id: string;
};

export type InboxRuleMatchItem = {
  sourceApp: string;
  sourceAppName: string | null;
  originalTitle: string | null;
  originalText: string;
  parsedName: string | null;
  parsedAmount: number | null;
};

export type InboxRuleAppliedField = "categoryId" | "personId";

export type InboxRuleResolution = {
  categoryId: string | null;
  personId: string | null;
  appliedRules: Array<{
    id: string;
    name: string;
    fields: InboxRuleAppliedField[];
  }>;
};

export type InboxRuleCode =
  | "inbox_rule_name_blank"
  | "inbox_rule_conditions_required"
  | "inbox_rule_too_many_conditions"
  | "inbox_rule_actions_required"
  | "inbox_rule_invalid_priority"
  | "inbox_rule_invalid_condition";

export class InboxRuleError extends Error {
  readonly code: InboxRuleCode;

  constructor(code: InboxRuleCode, message: string) {
    super(message);
    this.name = "InboxRuleError";
    this.code = code;
  }
}

export function createInboxRuleDraft(input: InboxRuleDraftInput): InboxRuleDraftInput {
  const name = normalizeInboxSingleLine(input.name);
  if (!name) {
    throw new InboxRuleError("inbox_rule_name_blank", "Inbox rule name cannot be blank");
  }
  if (input.conditions.length === 0) {
    throw new InboxRuleError(
      "inbox_rule_conditions_required",
      "Inbox rule must contain at least one condition",
    );
  }
  if (input.conditions.length > inboxRuleMaximumConditions) {
    throw new InboxRuleError(
      "inbox_rule_too_many_conditions",
      "Inbox rule contains too many conditions",
    );
  }
  if (!input.categoryId && !input.personId) {
    throw new InboxRuleError(
      "inbox_rule_actions_required",
      "Inbox rule must fill at least one field",
    );
  }
  if (
    !Number.isInteger(input.priority) ||
    input.priority < inboxRulePriorityMinimum ||
    input.priority > inboxRulePriorityMaximum
  ) {
    throw new InboxRuleError("inbox_rule_invalid_priority", "Inbox rule priority is invalid");
  }

  return {
    ...input,
    name,
    conditions: input.conditions.map(normalizeCondition),
  };
}

export function resolveInboxRules(
  item: InboxRuleMatchItem,
  rules: InboxRuleCandidate[],
): InboxRuleResolution {
  const resolution: InboxRuleResolution = {
    categoryId: null,
    personId: null,
    appliedRules: [],
  };
  const orderedRules = [...rules].sort(
    (left, right) =>
      left.priority - right.priority ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  );

  for (const rule of orderedRules) {
    if (!rule.isActive || !matchesRule(item, rule)) continue;

    const fields: InboxRuleAppliedField[] = [];
    if (resolution.categoryId === null && rule.categoryId) {
      resolution.categoryId = rule.categoryId;
      fields.push("categoryId");
    }
    if (resolution.personId === null && rule.personId) {
      resolution.personId = rule.personId;
      fields.push("personId");
    }
    if (fields.length > 0) {
      resolution.appliedRules.push({ id: rule.id, name: rule.name, fields });
    }
    if (resolution.categoryId !== null && resolution.personId !== null) break;
  }

  return resolution;
}

function normalizeCondition(condition: InboxRuleCondition): InboxRuleCondition {
  if (condition.field === "parsedAmount") {
    if (!Number.isFinite(condition.value) || condition.value <= 0) {
      throw new InboxRuleError(
        "inbox_rule_invalid_condition",
        "Inbox rule amount condition is invalid",
      );
    }
    return { ...condition, value: Math.round(condition.value * 100) / 100 };
  }

  const value = normalizeInboxSingleLine(condition.value);
  if (!value) {
    throw new InboxRuleError(
      "inbox_rule_invalid_condition",
      "Inbox rule text condition cannot be blank",
    );
  }
  return { ...condition, value };
}

function matchesRule(item: InboxRuleMatchItem, rule: InboxRuleCandidate) {
  const matches = rule.conditions.map((condition) => matchesCondition(item, condition));
  return rule.matchMode === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

function matchesCondition(item: InboxRuleMatchItem, condition: InboxRuleCondition) {
  if (condition.field === "parsedAmount") {
    if (item.parsedAmount === null || !Number.isFinite(item.parsedAmount)) return false;
    const actual = Math.round(item.parsedAmount * 100);
    const expected = Math.round(condition.value * 100);
    if (condition.operator === "equals") return actual === expected;
    if (condition.operator === "greaterThan") return actual > expected;
    return actual < expected;
  }

  const rawValue = item[condition.field];
  if (rawValue === null) return false;
  const actual = normalizeForMatch(rawValue);
  const expected = normalizeForMatch(condition.value);
  if (condition.operator === "equals") return actual === expected;
  if (condition.operator === "startsWith") return actual.startsWith(expected);
  if (condition.operator === "endsWith") return actual.endsWith(expected);
  return actual.includes(expected);
}

function normalizeForMatch(value: string) {
  return normalizeInboxSingleLine(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

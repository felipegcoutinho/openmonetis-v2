import { isPayable } from "./bills";
import {
  type BusinessCalendar,
  defaultBusinessCalendar,
  isBusinessDay,
  isRecurringHoliday,
  listNationalHolidays,
  type nationalHolidayIds,
} from "./business-calendars";

export const dueDateRuleTargets = ["payable", "invoice"] as const;
export const dueDateAdjustments = ["next", "previous", "none"] as const;
export type DueDateRule = {
  id: string;
  name: string;
  target: (typeof dueDateRuleTargets)[number];
  scope: "all" | "selected";
  cardIds: string[];
  transactionIds: string[];
  seriesIds: string[];
  adjustment: (typeof dueDateAdjustments)[number];
  weekends: boolean;
  holidays: boolean;
};
export type DueDateRuleVersion = {
  revision: number;
  effectiveFrom: string;
  calendar: BusinessCalendar;
  rules: DueDateRule[];
};
export type DueDateRulesReader = {
  listVersions(userId: string): Promise<DueDateRuleVersion[]>;
};
export const emptyDueDateRulesReader: DueDateRulesReader = { listVersions: async () => [] };
export function defaultDueDateRules(effectiveFrom: string): DueDateRuleVersion {
  return {
    revision: 0,
    effectiveFrom,
    calendar: { ...defaultBusinessCalendar, holidays: [], recurringHolidays: [] },
    rules: [],
  };
}
export type DueDateContext = {
  target?: "payable" | "invoice";
  dueDate: string | null;
  type?: string;
  origin?: string;
  paymentMethod?: string | null;
  cardId?: string | null;
  transactionId?: string | null;
  seriesId?: string | null;
  excluded?: boolean;
  frozenDueDate?: string | null;
  frozenAdjustment?: DueDateAdjustmentDetails | null;
  isSettled?: boolean | null;
};
export type DueDateAdjustmentReason = {
  date: string;
  weekend: "saturday" | "sunday" | null;
  nationalHolidayId: (typeof nationalHolidayIds)[number] | null;
  additionalHoliday: boolean;
};
export type DueDateAdjustmentDetails = {
  direction: "next" | "previous";
  ruleName: string | null;
  reasons: DueDateAdjustmentReason[];
};
export type DueDateResolution = {
  originalDueDate: string | null;
  dueDate: string | null;

  dueDateAdjustment: DueDateAdjustmentDetails | null;
  dueDateExceptionEditable: boolean;
};
export function resolveDueDate(
  input: DueDateContext,
  versions: DueDateRuleVersion[],
): DueDateResolution {
  const originalDueDate = input.dueDate;
  const target = getDueDateTarget(input);
  const dueDateExceptionEditable = Boolean(
    target && originalDueDate && !input.isSettled && !input.frozenDueDate,
  );
  const unchanged: DueDateResolution = {
    originalDueDate,
    dueDate: originalDueDate,
    dueDateAdjustment: null,
    dueDateExceptionEditable,
  };
  if (input.frozenDueDate)
    return {
      ...unchanged,
      dueDate: input.frozenDueDate,
      dueDateAdjustment: input.frozenAdjustment ?? null,
    };
  if (!originalDueDate || input.excluded || input.isSettled) return unchanged;
  const version =
    [...versions]
      .filter((item) => item.effectiveFrom <= originalDueDate)
      .sort((a, b) => b.revision - a.revision)[0] ?? defaultDueDateRules("0001-01-01");
  if (!target) return unchanged;
  const customRule = version.rules.find((rule) => matchesDueDateRule(rule, input));
  const rule = customRule ?? { adjustment: "next" as const, weekends: true, holidays: true };
  if (rule.adjustment === "none") return unchanged;
  const weekday = new Date(`${originalDueDate}T00:00:00.000Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const holiday = !isBusinessDay(originalDueDate, {
    ...version.calendar,
    workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
  });
  if (!(rule.weekends && weekend) && !(rule.holidays && holiday)) return unchanged;
  const calendar: BusinessCalendar = { ...version.calendar, workingWeekdays: [1, 2, 3, 4, 5] };
  const reasons: DueDateAdjustmentReason[] = [];
  for (let offset = 0; offset <= 370; offset++) {
    const date = new Date(`${originalDueDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + (rule.adjustment === "next" ? offset : -offset));
    const dueDate = date.toISOString().slice(0, 10);
    if (isBusinessDay(dueDate, calendar)) {
      const ruleName = customRule?.name ?? null;
      return {
        originalDueDate,
        dueDate,
        dueDateExceptionEditable,
        dueDateAdjustment: offset ? { direction: rule.adjustment, ruleName, reasons } : null,
      };
    }
    const day = date.getUTCDay();
    reasons.push({
      date: dueDate,
      weekend: day === 6 ? "saturday" : day === 0 ? "sunday" : null,
      nationalHolidayId: calendar.includeNationalHolidays
        ? (listNationalHolidays(date.getUTCFullYear()).find((holiday) => holiday.date === dueDate)
            ?.id ?? null)
        : null,
      additionalHoliday:
        calendar.holidays.includes(dueDate) || isRecurringHoliday(dueDate, calendar),
    });
  }
  throw new DueDateRuleError("CALENDAR_NO_BUSINESS_DAY");
}
export function matchesDueDateRule(rule: DueDateRule, input: DueDateContext) {
  if (rule.target === "invoice")
    return Boolean(
      input.target === "invoice" &&
        (rule.scope === "all" || Boolean(input.cardId && rule.cardIds.includes(input.cardId))),
    );
  return (
    isPayable(input) &&
    (rule.scope === "all" ||
      Boolean(input.transactionId && rule.transactionIds.includes(input.transactionId)) ||
      Boolean(input.seriesId && rule.seriesIds.includes(input.seriesId)))
  );
}
export class DueDateRuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
/** Returns the ids of rules that cover at least one item also covered by another rule. */
export function findDueDateRuleConflicts(rules: DueDateRule[]) {
  const conflicting = new Set<string>();
  for (let i = 0; i < rules.length; i++)
    for (const other of rules.slice(i + 1)) {
      const rule = rules[i];
      if (rule.target !== other.target) continue;
      if (
        rule.scope === "all" ||
        other.scope === "all" ||
        rule.cardIds.some((id) => other.cardIds.includes(id)) ||
        rule.transactionIds.some((id) => other.transactionIds.includes(id)) ||
        rule.seriesIds.some((id) => other.seriesIds.includes(id))
      ) {
        conflicting.add(rule.id);
        conflicting.add(other.id);
      }
    }
  return conflicting;
}
export function validateDueDateRuleConflicts(rules: DueDateRule[]) {
  if (findDueDateRuleConflicts(rules).size) throw new DueDateRuleError("DUE_DATE_RULE_CONFLICT");
}

export type DueDateExceptionState = {
  target: "transaction" | "recurring" | "invoice";
  isSettled: boolean;
  hasPayments?: boolean;
  datesCustomized?: boolean;
  type?: string;
  origin?: string;
  paymentMethod?: string | null;
  dueDate?: string | null;
  validOccurrence?: boolean;
};
export function assertDueDateExceptionEditable(state: DueDateExceptionState) {
  if (state.isSettled || state.hasPayments)
    throw new DueDateRuleError("DUE_DATE_EXCEPTION_SETTLED");
  if (state.target === "invoice") {
    if (state.datesCustomized) throw new DueDateRuleError("DUE_DATE_EXCEPTION_CUSTOM_DATES");
    return;
  }
  if (!isPayable({ ...state, dueDate: state.dueDate ?? null }))
    throw new DueDateRuleError("DUE_DATE_EXCEPTION_UNSUPPORTED");
  if (state.target === "recurring" && !state.validOccurrence)
    throw new DueDateRuleError("INVALID_RECURRING_OCCURRENCE");
}

function getDueDateTarget(input: DueDateContext) {
  if (input.target === "invoice") return "invoice";
  if (isPayable(input)) return "payable";
  return null;
}

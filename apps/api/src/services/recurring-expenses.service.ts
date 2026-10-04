import { type CardClosingRule, resolveCardClosingRule } from "@openmonetis/domain/cards";
import {
  getNextRecurringOccurrenceDate,
  getRecurringDueDate,
  isValidRecurringExpenseOccurrence,
  projectRecurringExpenseOccurrences,
} from "@openmonetis/domain/recurring-expenses";
import {
  addMonthsToPeriod,
  deriveTransactionPeriod,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
  validateTransactionSplits,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  RecurringExpensesOutput,
  RecurringExpensesReportOutput,
  UpdateRecurringExpenseInput,
} from "@openmonetis/validators/recurring-expenses";
import { badRequest, notFound } from "../utils/errors";

export type RecurringExpenseRuleRecord = {
  id: string;
  userId: string;
  seriesId: string;
  anchorDate: Date;
  personId: string;
  type: "income" | "expense" | "transfer";
  paymentMethod: PaymentMethod;
  name: string;
  amount: string;
  adminAmount: string | null;
  startDate: Date;
  endDate: Date | null;
  frequency: RecurrenceFrequency;
  accountId: string | null;
  cardId: string | null;
  categoryId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  dueDate: Date | null;
  isSettled: boolean | null;
  note: string | null;
  status: "active" | "paused" | "cancelled";
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  accountName: string | null;
  accountLogo: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  cardName: string | null;
  cardLogo: string | null;
  cardClosingDay: number | null;
  cardClosingRuleType: "fixedDay" | "daysBeforeDue" | null;
  cardClosingOffsetDays: number | null;
  cardClosingOffsetMode: "calendarDays" | "weekdays" | null;
  cardClosingDayPurchasesNextInvoice: boolean | null;
  cardDueDay: number | null;
  hasSplits: boolean;
};

type OwnedRecurringExpenseRule = Omit<
  RecurringExpenseRuleRecord,
  | "adminAmount"
  | "personName"
  | "personAvatarUrl"
  | "personRole"
  | "accountName"
  | "accountLogo"
  | "categoryName"
  | "categoryIcon"
  | "cardName"
  | "cardLogo"
  | "cardClosingDay"
  | "cardClosingRuleType"
  | "cardClosingOffsetDays"
  | "cardClosingOffsetMode"
  | "cardClosingDayPurchasesNextInvoice"
  | "cardDueDay"
  | "hasSplits"
> & {
  personRole: "admin" | "external";
  splits: Array<{ personId: string; amount: string; personRole: "admin" | "external" }>;
};

export type RecurringExpensesRepository = {
  listForPeriod(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RecurringExpenseRuleRecord[]>;
  findForUser(id: string, userId: string): Promise<OwnedRecurringExpenseRule | null>;
  listOccurrenceStates(
    userId: string,
    seriesIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ recurringSeriesId: string; purchaseDate: Date; isSettled: boolean }>>;
  listSplitPeople(
    userId: string,
    ruleIds: string[],
  ): Promise<
    Array<{
      recurringRuleId: string;
      personId: string;
      personName: string;
      personAvatarUrl: string | null;
      amount: string;
    }>
  >;
  versionForUser(input: {
    id: string;
    userId: string;
    effectiveDate: string;
    nextDate: string | null;
    mode: "editFuture" | "editSingle" | "pause" | "resume" | "skip" | "stop";
    changes?: {
      name: string;
      amount: string;
      splitShares?: Array<{ personId: string; amount: string }>;
    };
  }): Promise<boolean>;
};

export function createRecurringExpensesService(
  repository: RecurringExpensesRepository,
  getToday: () => string = getCurrentDateInBrazil,
  recurringExternalExpenses: {
    synchronize(ownerUserId: string, period: string): Promise<unknown>;
  } = { synchronize: async () => undefined },
) {
  async function synchronizeExternalExpenses(ownerUserId: string, occurrenceDate: string) {
    const startPeriod = occurrenceDate.slice(0, 7);
    const currentPeriod = getToday().slice(0, 7);
    for (let period = startPeriod; period <= currentPeriod; period = addMonthsToPeriod(period, 1)) {
      try {
        await recurringExternalExpenses.synchronize(ownerUserId, period);
      } catch (error) {
        console.error("recurring_external_expense_sync_failed", { ownerUserId, period, error });
      }
    }
  }
  async function getOwnedRule(id: string, userId: string) {
    const rule = await repository.findForUser(id, userId);
    if (rule?.type !== "expense" || !["active", "paused"].includes(rule.status)) {
      throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
    }
    const belongsToAdmin = rule.splits.length
      ? rule.splits.some((split) => split.personRole === "admin")
      : rule.personRole === "admin";
    if (!belongsToAdmin) {
      throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
    }
    return rule;
  }

  async function getOwnedOccurrence(id: string, purchaseDate: string, userId: string) {
    const rule = await getOwnedRule(id, userId);
    if (rule.status !== "active") {
      throw badRequest("Recurring expense is paused", "RECURRING_EXPENSE_PAUSED");
    }
    const startDate = dateString(rule.startDate);
    const endDate = rule.endDate ? dateString(rule.endDate) : null;
    if (
      !isValidRecurringExpenseOccurrence({
        anchorDate: dateString(rule.anchorDate),
        date: purchaseDate,
        endDate,
        frequency: rule.frequency,
        startDate,
      })
    ) {
      throw badRequest("Invalid recurring occurrence", "INVALID_RECURRING_OCCURRENCE");
    }
    const nextDate = getNextRecurringOccurrenceDate({
      anchorDate: dateString(rule.anchorDate),
      currentDate: purchaseDate,
      endDate,
      frequency: rule.frequency,
      startDate,
    });
    return { rule, nextDate };
  }

  return {
    async list(period: string, userId: string): Promise<RecurringExpensesOutput> {
      const periodStart = new Date(`${addMonthsToPeriod(period, -2)}-01T00:00:00.000Z`);
      const periodEnd = lastInstantOfPeriod(period);
      const rules = await repository.listForPeriod(userId, periodStart, periodEnd);
      const ruleIds = rules.map((rule) => rule.id);
      const seriesIds = [...new Set(rules.map((rule) => rule.seriesId))];
      const [states, splitPeople] = await Promise.all([
        repository.listOccurrenceStates(userId, seriesIds, periodStart, periodEnd),
        repository.listSplitPeople(userId, ruleIds),
      ]);
      const splitPeopleByRule = groupSplitPeople(splitPeople);
      const settlement = new Map(
        states.map((state) => [
          `${state.recurringSeriesId}:${dateString(state.purchaseDate)}`,
          state.isSettled,
        ]),
      );
      const purchasePeriods = [
        addMonthsToPeriod(period, -2),
        addMonthsToPeriod(period, -1),
        period,
      ];
      const items = rules.flatMap<RecurringExpensesOutput["items"][number]>((rule) => {
        if (rule.adminAmount === null) return [];
        const startDate = dateString(rule.startDate);
        const endDate = rule.endDate ? dateString(rule.endDate) : null;
        const card = getCard(rule);

        if (rule.status === "paused") {
          if (endDate && endDate.slice(0, 7) <= period) return [];
          return [
            {
              id: rule.id,
              name: rule.name,
              amount: Math.abs(Number(rule.adminAmount)),
              totalAmount: Math.abs(Number(rule.amount)),
              paymentMethod: rule.paymentMethod,
              frequency: rule.frequency,
              purchaseDate: occurrenceDateInPeriod(startDate, period),
              personName: rule.personName,
              personAvatarUrl: rule.personAvatarUrl,
              accountName: rule.accountName,
              accountLogo: rule.accountLogo,
              categoryName: rule.categoryName,
              categoryIcon: rule.categoryIcon,
              cardName: rule.cardName,
              cardLogo: rule.cardLogo,
              splitPeople: splitPeopleByRule.get(rule.id) ?? [],
              isSettled: false,
              canEdit: false,
              status: "paused" as const,
            },
          ];
        }

        return purchasePeriods.flatMap((purchasePeriod) =>
          listRecurrenceDatesInPeriod({
            anchorDate: dateString(rule.anchorDate),
            startDate,
            endDate,
            frequency: rule.frequency,
            period: purchasePeriod,
          }).flatMap((purchaseDate) => {
            const dueDate = getRecurringDueDate(
              rule.dueDate ? dateString(rule.dueDate) : null,
              purchaseDate,
            );
            const occurrencePeriod = deriveTransactionPeriod({
              paymentMethod: rule.paymentMethod,
              purchaseDate,
              dueDate,
              card,
            });
            if (occurrencePeriod !== period) return [];

            return [
              {
                id: rule.id,
                name: rule.name,
                amount: Math.abs(Number(rule.adminAmount)),
                totalAmount: Math.abs(Number(rule.amount)),
                paymentMethod: rule.paymentMethod,
                frequency: rule.frequency,
                purchaseDate,
                personName: rule.personName,
                personAvatarUrl: rule.personAvatarUrl,
                accountName: rule.accountName,
                accountLogo: rule.accountLogo,
                categoryName: rule.categoryName,
                categoryIcon: rule.categoryIcon,
                cardName: rule.cardName,
                cardLogo: rule.cardLogo,
                splitPeople: splitPeopleByRule.get(rule.id) ?? [],
                isSettled:
                  settlement.get(`${rule.seriesId}:${purchaseDate}`) ?? rule.isSettled ?? false,
                canEdit: true,
                status: "active" as const,
              },
            ];
          }),
        );
      });

      return {
        period,
        items: items.sort(
          (left, right) =>
            Number(left.status === "paused") - Number(right.status === "paused") ||
            right.amount - left.amount ||
            left.name.localeCompare(right.name, "pt-BR"),
        ),
      };
    },

    async report(period: string, userId: string): Promise<RecurringExpensesReportOutput> {
      const today = getToday();
      const projectionPeriods = [
        period,
        addMonthsToPeriod(period, 1),
        addMonthsToPeriod(period, 2),
      ];
      const reportEnd = lastInstantOfPeriod(projectionPeriods.at(-1) as string);
      const rules = await repository.listForPeriod(
        userId,
        new Date(`${period}-01T00:00:00.000Z`),
        reportEnd,
      );
      const splitPeople = await repository.listSplitPeople(
        userId,
        rules.map((rule) => rule.id),
      );
      const splitPeopleByRule = groupSplitPeople(splitPeople);
      const projectionRules = rules.filter((rule) => rule.adminAmount !== null);
      const currentAdminRules = projectionRules.filter((rule) => rule.endDate === null);
      const totals = new Map(projectionPeriods.map((projectionPeriod) => [projectionPeriod, 0]));

      for (const rule of projectionRules) {
        if (rule.status !== "active") continue;
        const startDate = dateString(rule.startDate);
        const endDate = rule.endDate ? dateString(rule.endDate) : null;
        const occurrences = projectRecurringExpenseOccurrences({
          anchorDate: dateString(rule.anchorDate),
          startDate,
          endDate,
          frequency: rule.frequency,
          periods: projectionPeriods,
        });
        const amountCents = Math.round(Math.abs(Number(rule.adminAmount)) * 100);
        for (const occurrence of occurrences) {
          totals.set(occurrence.period, (totals.get(occurrence.period) ?? 0) + amountCents);
        }
      }

      const items = currentAdminRules.map((rule) => {
        const startDate = dateString(rule.startDate);
        const amount = Math.abs(Number(rule.adminAmount));
        const actionDate = getNextRecurringOccurrenceDate({
          anchorDate: dateString(rule.anchorDate),
          currentDate: today,
          endDate: null,
          frequency: rule.frequency,
          startDate,
        });
        const nextOccurrenceDate = rule.status === "active" ? actionDate : null;

        return {
          id: rule.id,
          name: rule.name,
          amount,
          totalAmount: Math.abs(Number(rule.amount)),
          paymentMethod: rule.paymentMethod,
          frequency: rule.frequency,
          purchaseDate: actionDate ?? occurrenceDateInPeriod(startDate, period),
          personName: rule.personName,
          personAvatarUrl: rule.personAvatarUrl,
          accountName: rule.accountName,
          accountLogo: rule.accountLogo,
          categoryName: rule.categoryName,
          categoryIcon: rule.categoryIcon,
          cardName: rule.cardName,
          cardLogo: rule.cardLogo,
          isSettled: false,
          canEdit: true,
          status: rule.status as "active" | "paused",
          actionDate,
          nextOccurrenceDate,
          splitPeople: splitPeopleByRule.get(rule.id) ?? [],
        };
      });

      return {
        period,
        summary: {
          activeCount: items.filter((item) => item.status === "active").length,
          pausedCount: items.filter((item) => item.status === "paused").length,
          projectedTotal: (totals.get(period) ?? 0) / 100,
        },
        projections: projectionPeriods.map((projectionPeriod) => ({
          period: projectionPeriod,
          total: (totals.get(projectionPeriod) ?? 0) / 100,
        })),
        items: items.sort(
          (left, right) =>
            Number(left.status === "paused") - Number(right.status === "paused") ||
            left.name.localeCompare(right.name, "pt-BR"),
        ),
      };
    },

    async update(
      id: string,
      purchaseDate: string,
      userId: string,
      input: UpdateRecurringExpenseInput,
    ) {
      const { rule, nextDate } = await getOwnedOccurrence(id, purchaseDate, userId);
      if (rule.splits.length) {
        const currentPersonIds = new Set(rule.splits.map((split) => split.personId));
        const submittedPersonIds = new Set(input.splitShares?.map((split) => split.personId) ?? []);
        if (
          !input.splitShares ||
          currentPersonIds.size !== submittedPersonIds.size ||
          [...currentPersonIds].some((personId) => !submittedPersonIds.has(personId))
        ) {
          throw badRequest(
            "Recurring split participants do not match",
            "RECURRING_SPLIT_PARTICIPANTS_MISMATCH",
          );
        }
        if (!validateTransactionSplits(input.amount, input.splitShares)) {
          throw badRequest("Invalid recurring split allocation", "INVALID_RECURRING_SPLIT");
        }
      } else if (input.splitShares) {
        throw badRequest("Recurring expense is not divided", "RECURRING_EXPENSE_NOT_DIVIDED");
      }
      const updated = await repository.versionForUser({
        id,
        userId,
        effectiveDate: purchaseDate,
        nextDate,
        mode: input.scope === "single" ? "editSingle" : "editFuture",
        changes: {
          name: input.name.trim(),
          amount: (-input.amount).toFixed(2),
          ...(input.splitShares
            ? {
                splitShares: input.splitShares.map((split) => ({
                  personId: split.personId,
                  amount: (-split.amount).toFixed(2),
                })),
              }
            : {}),
        },
      });
      if (!updated) throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
      await synchronizeExternalExpenses(userId, purchaseDate);
      return { success: true as const };
    },

    async skip(id: string, purchaseDate: string, userId: string) {
      const { nextDate } = await getOwnedOccurrence(id, purchaseDate, userId);
      const updated = await repository.versionForUser({
        id,
        userId,
        effectiveDate: purchaseDate,
        nextDate,
        mode: "skip",
      });
      if (!updated) throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
      await synchronizeExternalExpenses(userId, purchaseDate);
      return { success: true as const };
    },

    async pause(id: string, purchaseDate: string, userId: string) {
      await getOwnedOccurrence(id, purchaseDate, userId);
      const updated = await repository.versionForUser({
        id,
        userId,
        effectiveDate: purchaseDate,
        nextDate: null,
        mode: "pause",
      });
      if (!updated) throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
      await synchronizeExternalExpenses(userId, purchaseDate);
      return { success: true as const };
    },

    async resume(id: string, purchaseDate: string, userId: string) {
      const rule = await getOwnedRule(id, userId);
      if (rule.status !== "paused") {
        throw badRequest("Recurring expense is not paused", "RECURRING_EXPENSE_NOT_PAUSED");
      }
      const updated = await repository.versionForUser({
        id,
        userId,
        effectiveDate: purchaseDate,
        nextDate: null,
        mode: "resume",
      });
      if (!updated) throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
      await synchronizeExternalExpenses(userId, purchaseDate);
      return { success: true as const };
    },

    async stop(id: string, purchaseDate: string, userId: string) {
      const rule = await getOwnedRule(id, userId);
      if (rule.status === "active") await getOwnedOccurrence(id, purchaseDate, userId);
      const updated = await repository.versionForUser({
        id,
        userId,
        effectiveDate: purchaseDate,
        nextDate: null,
        mode: "stop",
      });
      if (!updated) throw notFound("Recurring expense not found", "RECURRING_EXPENSE_NOT_FOUND");
      await synchronizeExternalExpenses(userId, purchaseDate);
      return { success: true as const };
    },
  };
}

function getCard(rule: RecurringExpenseRuleRecord): {
  closingDay: number | null;
  closingRule: CardClosingRule;
  dueDay: number;
} | null {
  if (!rule.cardClosingRuleType || rule.cardDueDay === null) return null;
  return {
    closingDay: rule.cardClosingDay,
    closingRule: resolveCardClosingRule({
      closingRuleType: rule.cardClosingRuleType,
      closingDay: rule.cardClosingDay,
      closingOffsetDays: rule.cardClosingOffsetDays,
      closingOffsetMode: rule.cardClosingOffsetMode,
      closingDayPurchasesNextInvoice: rule.cardClosingDayPurchasesNextInvoice ?? false,
    }),
    dueDay: rule.cardDueDay,
  };
}

function dateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function groupSplitPeople(
  splitPeople: Array<{
    recurringRuleId: string;
    personId: string;
    personName: string;
    personAvatarUrl: string | null;
    amount: string;
  }>,
) {
  const grouped = new Map<
    string,
    Array<{ id: string; name: string; avatarUrl: string | null; amount: number }>
  >();
  for (const person of splitPeople) {
    const people = grouped.get(person.recurringRuleId) ?? [];
    people.push({
      id: person.personId,
      name: person.personName,
      avatarUrl: person.personAvatarUrl,
      amount: Math.abs(Number(person.amount)),
    });
    grouped.set(person.recurringRuleId, people);
  }
  return grouped;
}

function lastInstantOfPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function occurrenceDateInPeriod(startDate: string, period: string) {
  const day = Number(startDate.slice(8, 10));
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export type RecurringExpensesService = ReturnType<typeof createRecurringExpensesService>;

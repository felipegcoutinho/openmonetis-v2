import { buildRecurringTransactionsReport } from "@openmonetis/domain/recurring-transactions";
import type { SettlementAwareRule } from "@openmonetis/domain/settlements";
import type { PaymentMethod, RecurrenceFrequency } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  RecurringTransactionsReportOutput,
  RecurringTransactionsReportQuery,
} from "@openmonetis/validators/recurring-transactions";

export type RecurringRuleReportRecord = SettlementAwareRule & {
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
  versionEndDate?: Date | null;
  recurrenceEndDate?: Date | null;
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

export type RecurringTransactionsRepository = {
  listForReport(userId: string, type: "income" | "expense"): Promise<RecurringRuleReportRecord[]>;
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
};

export function createRecurringTransactionsService(
  repository: RecurringTransactionsRepository,
  getToday = getCurrentDateInBrazil,
) {
  return {
    async report(
      query: RecurringTransactionsReportQuery,
      userId: string,
    ): Promise<RecurringTransactionsReportOutput> {
      const rules = (await repository.listForReport(userId, query.type)).filter(
        (rule) => rule.adminAmount !== null,
      );
      const today = getToday();
      const period = today.slice(0, 7);
      const projection = buildRecurringTransactionsReport({
        period,
        today,
        versions: rules.map((rule) => ({
          id: rule.id,
          seriesId: rule.seriesId,
          status: rule.status,
          startDate: date(rule.startDate),
          endDate:
            rule.versionEndDate === undefined
              ? rule.endDate
                ? date(rule.endDate)
                : null
              : rule.versionEndDate
                ? date(rule.versionEndDate)
                : null,
          recurrenceEndDate: rule.recurrenceEndDate ? date(rule.recurrenceEndDate) : null,
          anchorDate: date(rule.anchorDate),
          frequency: rule.frequency,
          amount: rule.adminAmount as string,
          occurrenceOverrides: rule.occurrenceOverrides,
          allocationPersonId: "admin",

          dueDate: rule.dueDate ? date(rule.dueDate) : null,
        })),
      });
      const byId = new Map(rules.map((rule) => [rule.id, rule]));
      const splitPeople = await repository.listSplitPeople(
        userId,
        projection.items.map((item) => item.ruleId),
      );
      return {
        period,
        type: query.type,
        summary: projection.summary,
        projections: projection.projections,
        items: projection.items
          .map((item) => {
            const rule = byId.get(item.ruleId) as RecurringRuleReportRecord;
            return {
              id: rule.id,
              seriesId: item.seriesId,
              type: query.type,
              name: rule.name,
              amount: Math.abs(Number(rule.adminAmount)),
              totalAmount: Math.abs(Number(rule.amount)),
              paymentMethod: rule.paymentMethod,
              frequency: rule.frequency,
              recurrenceEndDate: rule.recurrenceEndDate ? date(rule.recurrenceEndDate) : null,
              purchaseDate: item.actionDate ?? date(rule.startDate),
              personName: rule.personName,
              personAvatarUrl: rule.personAvatarUrl,
              accountName: rule.accountName,
              accountLogo: rule.accountLogo,
              categoryName: rule.categoryName,
              categoryIcon: rule.categoryIcon,
              cardName: rule.cardName,
              cardLogo: rule.cardLogo,
              splitPeople: splitPeople
                .filter((split) => split.recurringRuleId === rule.id)
                .map((split) => ({
                  id: split.personId,
                  name: split.personName,
                  avatarUrl: split.personAvatarUrl,
                  amount: Math.abs(Number(split.amount)),
                })),
              isSettled: false,
              canEdit: item.status === "active",
              status: item.status,
              actionDate: item.actionDate,
              nextOccurrenceDate: item.nextOccurrenceDate,
            };
          })
          .sort(
            (a, b) =>
              (a.actionDate ?? "9999").localeCompare(b.actionDate ?? "9999") ||
              a.name.localeCompare(b.name, "pt-BR"),
          ),
      };
    },
  };
}
function date(value: Date) {
  return value.toISOString().slice(0, 10);
}
export type RecurringTransactionsService = ReturnType<typeof createRecurringTransactionsService>;

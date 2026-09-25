import {
  calculateOpenBillsTotal,
  getBillStatus,
  listRecurringBillOccurrences,
} from "@openmonetis/domain/bills";
import type { RecurrenceFrequency, TransactionCondition } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type {
  CreateBillPaymentInput,
  DashboardBill,
  DashboardBillsOutput,
} from "@openmonetis/validators/bills";
import { badRequest, notFound } from "../utils/errors";

type BillRelationRecord = {
  accountId: string | null;
  accountName: string | null;
  accountLogo: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  splits: BillPersonRecord[];
};

type BillPersonRecord = {
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  amount: string;
};

type PersistedBillRecord = BillRelationRecord & {
  id: string;
  purchaseDate: string;
  name: string;
  amount: string;
  dueDate: string;
  boletoPaymentDate: string | null;
  isSettled: boolean;
  condition: TransactionCondition;
  currentInstallment: number | null;
  installmentCount: number | null;
};

type RecurringBillRecord = BillRelationRecord & {
  id: string;
  seriesId: string;
  anchorDate: string;
  startDate: string;
  endDate?: string | null;
  dueDate: string;
  frequency: RecurrenceFrequency;
  name: string;
  amount: string;
  isSettled: boolean;
};

type BillOccurrenceStateRecord = {
  recurringSeriesId: string;
  purchaseDate: string;
  isSettled: boolean;
  accountId: string | null;
  boletoPaymentDate: string | null;
};

type BillAccountRecord = { id: string; name: string; logo: string | null };

export type BillsRepository = {
  listPersisted(userId: string, period: string): Promise<PersistedBillRecord[]>;
  listRecurring(userId: string, periodEnd: Date): Promise<RecurringBillRecord[]>;
  listOccurrenceStates(
    userId: string,
    seriesIds: string[],
    periodStart: string,
    periodEnd: string,
  ): Promise<BillOccurrenceStateRecord[]>;
  listAccounts(userId: string): Promise<BillAccountRecord[]>;
  payPersisted(userId: string, billId: string, accountId: string, paidAt: string): Promise<boolean>;
  payRecurring(
    userId: string,
    recurringRuleId: string,
    purchaseDate: string,
    accountId: string,
    paidAt: string,
  ): Promise<boolean>;
};

export function createBillsService(repository: BillsRepository, today = getCurrentDateInBrazil) {
  async function get(period: string, userId: string): Promise<DashboardBillsOutput> {
    const periodStart = `${period}-01`;
    const periodEnd = getPeriodEndDateString(period);
    const [persisted, recurring, accounts] = await Promise.all([
      repository.listPersisted(userId, period),
      repository.listRecurring(userId, new Date(`${periodEnd}T23:59:59.999Z`)),
      repository.listAccounts(userId),
    ]);
    const occurrenceStates = await repository.listOccurrenceStates(
      userId,
      [...new Set(recurring.map((rule) => rule.seriesId))],
      periodStart,
      periodEnd,
    );
    const states = new Map(
      occurrenceStates.map((state) => [`${state.recurringSeriesId}:${state.purchaseDate}`, state]),
    );
    const persistedItems: DashboardBill[] = persisted.map((bill) =>
      buildBill({
        ...bill,
        recordId: bill.id,
        recurringRuleId: null,
        recurrenceFrequency: null,
        period,
        today: today(),
      }),
    );
    const recurringItems: DashboardBill[] = recurring.flatMap((rule) =>
      listRecurringBillOccurrences({
        ruleId: rule.id,
        anchorDate: rule.anchorDate,
        startDate: rule.startDate,
        endDate: rule.endDate,
        dueDate: rule.dueDate,
        frequency: rule.frequency,
        period,
      }).map((occurrence) => {
        const state = states.get(`${rule.seriesId}:${occurrence.purchaseDate}`);
        const paymentAccount = state?.accountId
          ? accounts.find((account) => account.id === state.accountId)
          : null;
        return buildBill({
          ...rule,
          ...occurrence,
          recordId: null,
          recurringRuleId: rule.id,
          condition: "recurring",
          currentInstallment: null,
          installmentCount: null,
          recurrenceFrequency: rule.frequency,
          isSettled: state?.isSettled ?? rule.isSettled,
          boletoPaymentDate: state?.boletoPaymentDate ?? null,
          accountId: state?.accountId ?? rule.accountId,
          accountName: paymentAccount?.name ?? rule.accountName,
          accountLogo: paymentAccount?.logo ?? rule.accountLogo,
          period,
          today: today(),
        });
      }),
    );
    const items = [...persistedItems, ...recurringItems].sort(compareBills);
    return {
      period,
      totalOpen: calculateOpenBillsTotal(items),
      overdueCount: items.filter((bill) => bill.status === "overdue").length,
      accounts,
      items,
    };
  }

  return {
    get,
    async pay(period: string, input: CreateBillPaymentInput, userId: string) {
      if (input.paidAt > today()) {
        throw badRequest("Payment date cannot be in the future", "bill_payment_date_future");
      }
      const snapshot = await get(period, userId);
      const bill = snapshot.items.find((item) => item.id === input.billId && !item.isSettled);
      if (!bill) throw notFound("Bill not found", "bill_not_found");
      if (!snapshot.accounts.some((account) => account.id === input.accountId)) {
        throw notFound("Account not found", "account_not_found");
      }
      const paid = bill.recordId
        ? await repository.payPersisted(userId, bill.recordId, input.accountId, input.paidAt)
        : await repository.payRecurring(
            userId,
            bill.recurringRuleId as string,
            bill.purchaseDate,
            input.accountId,
            input.paidAt,
          );
      return paid
        ? { id: bill.id, accountId: input.accountId, paidAt: input.paidAt }
        : Promise.reject(notFound("Bill not found", "bill_not_found"));
    },
  };
}

function buildBill(
  bill: BillRelationRecord & {
    id: string;
    recordId: string | null;
    recurringRuleId: string | null;
    purchaseDate: string;
    period: string;
    name: string;
    amount: string;
    dueDate: string;
    boletoPaymentDate: string | null;
    isSettled: boolean;
    condition: TransactionCondition;
    currentInstallment: number | null;
    installmentCount: number | null;
    recurrenceFrequency: RecurrenceFrequency | null;
    today: string;
  },
): DashboardBill {
  return {
    id: bill.id,
    recordId: bill.recordId,
    recurringRuleId: bill.recurringRuleId,
    purchaseDate: bill.purchaseDate,
    period: bill.period,
    name: bill.name,
    amount: Math.abs(Number(bill.amount)),
    dueDate: bill.dueDate,
    boletoPaymentDate: bill.boletoPaymentDate,
    isSettled: bill.isSettled,
    status: getBillStatus(bill),
    condition: bill.condition,
    currentInstallment: bill.currentInstallment,
    installmentCount: bill.installmentCount,
    recurrenceFrequency: bill.recurrenceFrequency,
    accountId: bill.accountId,
    accountName: bill.accountName,
    accountLogo: bill.accountLogo,
    categoryName: bill.categoryName,
    categoryIcon: bill.categoryIcon,
    people: (bill.splits.length
      ? bill.splits
      : [
          {
            personId: bill.personId,
            personName: bill.personName,
            personAvatarUrl: bill.personAvatarUrl,
            amount: bill.amount,
          },
        ]
    )
      .map((person) => ({
        ...person,
        amount: Math.abs(Number(person.amount)),
      }))
      .sort((left, right) => left.personName.localeCompare(right.personName)),
  };
}

function compareBills(left: DashboardBill, right: DashboardBill) {
  if (left.isSettled !== right.isSettled) return left.isSettled ? 1 : -1;
  return left.dueDate.localeCompare(right.dueDate) || left.name.localeCompare(right.name);
}

export type BillsService = ReturnType<typeof createBillsService>;

import type { BusinessCalendar } from "@openmonetis/domain/business-calendars";
import { buildCalendarMonth, type CalendarEntryInput } from "@openmonetis/domain/calendar";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getPeriodEndDateString } from "@openmonetis/shared/date-time";
import type { DashboardBillsOutput } from "@openmonetis/validators/bills";
import type { CalendarOutput } from "@openmonetis/validators/calendar";
import type { DashboardInvoicesOutput } from "@openmonetis/validators/invoices";

export type CalendarSources = {
  bills: { get(period: string, userId: string): Promise<DashboardBillsOutput> };
  invoices: { get(period: string, userId: string): Promise<DashboardInvoicesOutput> };
  notes: {
    listTasksDueBetween(
      userId: string,
      startDate: string,
      endDate: string,
    ): Promise<Array<{ id: string; title: string; dueDate: string; isCompleted: boolean }>>;
  };
  dueDateRules: { get(userId: string): Promise<{ calendar: BusinessCalendar }> };
};

/** Domain entry plus the reference each kind of the public contract carries. */
type CalendarSourceEntry = CalendarEntryInput &
  (
    | {
        kind: "bill";
        amount: number;
        billId: string;
        detail: string | null;
        categoryIcon: string | null;
      }
    | {
        kind: "invoiceDue" | "invoiceClosing";
        amount: number;
        cardId: string;
        invoicePeriod: string;
        logo: string | null;
      }
    | { kind: "task"; noteId: string; amount: null; openAmount: 0 }
  );

/** An invoice of a neighbouring reference month can close or fall due in the requested one. */
const invoicePeriodOffsets = [-1, 0, 1];

export function createCalendarService(
  sources: CalendarSources,
  today: () => string = getCurrentDateInBrazil,
) {
  return {
    async get(period: string, userId: string): Promise<CalendarOutput> {
      const [bills, invoiceSnapshots, tasks, rules] = await Promise.all([
        sources.bills.get(period, userId),
        Promise.all(
          invoicePeriodOffsets.map((offset) =>
            sources.invoices.get(addMonthsToPeriod(period, offset), userId),
          ),
        ),
        sources.notes.listTasksDueBetween(userId, `${period}-01`, getPeriodEndDateString(period)),
        sources.dueDateRules.get(userId),
      ]);

      const billEntries = bills.items.map(
        (bill): CalendarSourceEntry => ({
          id: `bill:${bill.id}`,
          kind: "bill",
          date: bill.dueDate,
          title: bill.name,
          amount: bill.amount,
          openAmount: bill.isSettled ? 0 : bill.amount,
          isDone: bill.isSettled,
          billId: bill.id,
          detail: bill.categoryName ?? bill.accountName,
          categoryIcon: bill.categoryIcon,
        }),
      );
      const invoiceEntries = invoiceSnapshots
        .flatMap((snapshot) => snapshot.items)
        .flatMap((invoice): CalendarSourceEntry[] => {
          const shared = {
            kind: "invoiceDue" as const,
            title: invoice.cardName,
            amount: invoice.amount,
            openAmount: invoice.remainingAmount,
            isDone: invoice.status === "paid",
            cardId: invoice.cardId,
            invoicePeriod: invoice.period,
            logo: invoice.logo,
          };
          return [
            {
              ...shared,
              id: `invoice-closing:${invoice.cardId}:${invoice.period}`,
              kind: "invoiceClosing" as const,
              date: invoice.closingDate,
            },
            {
              ...shared,
              id: `invoice-due:${invoice.cardId}:${invoice.period}`,
              date: invoice.dueDate,
            },
          ];
        });
      const taskEntries = tasks.map(
        (task): CalendarSourceEntry => ({
          id: `task:${task.id}`,
          kind: "task",
          date: task.dueDate,
          title: task.title,
          amount: null,
          openAmount: 0,
          isDone: task.isCompleted,
          noteId: task.id,
        }),
      );

      return buildCalendarMonth({
        period,
        today: today(),
        calendar: rules.calendar,
        entries: [...billEntries, ...invoiceEntries, ...taskEntries],
      });
    },
  };
}

export type CalendarService = ReturnType<typeof createCalendarService>;

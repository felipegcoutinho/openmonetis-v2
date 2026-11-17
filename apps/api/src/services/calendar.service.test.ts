import assert from "node:assert/strict";
import test from "node:test";
import { defaultBusinessCalendar } from "@openmonetis/domain/business-calendars";
import type { DashboardBill, DashboardBillsOutput } from "@openmonetis/validators/bills";
import type { DashboardInvoicesOutput } from "@openmonetis/validators/invoices";
import { type CalendarSources, createCalendarService } from "./calendar.service";

const userId = "00000000-0000-4000-8000-000000000001";
const cardId = "00000000-0000-4000-8000-000000000002";
const noteId = "00000000-0000-4000-8000-000000000003";

function bill(overrides: Partial<DashboardBill>): DashboardBill {
  return {
    id: "bill-1",
    recordId: null,
    recurringRuleId: null,
    purchaseDate: "2026-11-01",
    period: "2026-11",
    name: "Aluguel",
    paymentMethod: "boleto",
    amount: 1500,
    dueDate: "2026-11-10",
    boletoPaymentDate: null,
    settledDate: null,
    isSettled: false,
    status: "overdue",
    condition: "recurring",
    currentInstallment: null,
    installmentCount: null,
    recurrenceFrequency: "monthly",
    accountId: null,
    accountName: "Conta corrente",
    accountLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    people: [{ personId: userId, personName: "Eu", personAvatarUrl: null, amount: 1500 }],
    ...overrides,
  };
}

function invoices(period: string): DashboardInvoicesOutput {
  const items =
    period === "2026-10"
      ? [
          {
            cardId,
            accountId: cardId,
            cardName: "Nubank",
            logo: null,
            period,
            amount: 900,
            paidAmount: 500,
            remainingAmount: 400,
            status: "closed" as const,
            closingDate: "2026-10-28",
            dueDate: "2026-11-05",
            paymentCount: 1,
            latestPayment: null,
            payments: [],
            people: [],
          },
        ]
      : [];
  return { period, totalRemaining: 0, accounts: [], items };
}

function setup() {
  const requestedInvoicePeriods: string[] = [];
  let taskRange: string[] = [];
  const sources: CalendarSources = {
    bills: {
      async get(period): Promise<DashboardBillsOutput> {
        return {
          period,
          totalOpen: 1500,
          overdueCount: 1,
          accounts: [],
          items: [
            bill({}),
            bill({
              id: "bill-2",
              name: "Energia",
              amount: 210,
              dueDate: "2026-11-20",
              isSettled: true,
              status: "paid",
              categoryName: null,
            }),
          ],
        };
      },
    },
    invoices: {
      async get(period) {
        requestedInvoicePeriods.push(period);
        return invoices(period);
      },
    },
    notes: {
      async listTasksDueBetween(owner, startDate, endDate) {
        assert.equal(owner, userId);
        taskRange = [startDate, endDate];
        return [{ id: noteId, title: "Declarar IR", dueDate: "2026-11-20", isCompleted: false }];
      },
    },
    dueDateRules: {
      async get() {
        return { calendar: defaultBusinessCalendar };
      },
    },
  };
  return {
    service: createCalendarService(sources, () => "2026-11-15"),
    requestedInvoicePeriods,
    taskRange: () => taskRange,
  };
}

test("calendar gathers bills, invoices of neighbouring months and tasks by day", async () => {
  const { service, requestedInvoicePeriods, taskRange } = setup();
  const calendar = await service.get("2026-11", userId);

  assert.deepEqual(requestedInvoicePeriods.sort(), ["2026-10", "2026-11", "2026-12"]);
  assert.deepEqual(taskRange(), ["2026-11-01", "2026-11-30"]);
  assert.deepEqual(calendar.summary, {
    openAmount: 1900,
    paidAmount: 710,
    overdueCount: 2,
    entryCount: 4,
  });

  const day = (date: string) => calendar.days.find((item) => item.date === date);
  assert.deepEqual(day("2026-11-05")?.entries, [
    {
      id: `invoice-due:${cardId}:2026-10`,
      kind: "invoiceDue",
      date: "2026-11-05",
      title: "Nubank",
      amount: 900,
      openAmount: 400,
      status: "overdue",
      cardId,
      invoicePeriod: "2026-10",
      logo: null,
    },
  ]);
  assert.equal(day("2026-11-10")?.entries[0]?.kind, "bill");
  assert.deepEqual(
    day("2026-11-20")?.entries.map((entry) => [entry.kind, entry.status]),
    [
      ["task", "pending"],
      ["bill", "done"],
    ],
  );
  const rent = day("2026-11-10")?.entries[0];
  assert.ok(rent?.kind === "bill");
  assert.equal(rent.billId, "bill-1");
  assert.equal(rent.detail, "Moradia");
  assert.equal(
    calendar.days.some((item) => item.date === "2026-10-28"),
    false,
  );
});

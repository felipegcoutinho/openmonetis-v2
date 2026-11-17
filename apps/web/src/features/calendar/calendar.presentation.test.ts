import assert from "node:assert/strict";
import test from "node:test";
import {
  describeCalendarEntry,
  describeCalendarEntryCounts,
  formatCalendarDayHeader,
  getCalendarCellEntryTitle,
  getCalendarEntryAmountCaption,
  getCalendarKeyboardTarget,
  getCalendarLeadingBlankDays,
  groupCalendarDayEntries,
} from "./calendar.presentation";

test("calendar grid starts the month under its weekday", () => {
  assert.equal(getCalendarLeadingBlankDays("2026-11"), 0);
  assert.equal(getCalendarLeadingBlankDays("2026-12"), 2);
});

test("arrow keys move inside the month and stop at its edges", () => {
  assert.equal(getCalendarKeyboardTarget("2026-11-10", "ArrowRight", 30), "2026-11-11");
  assert.equal(getCalendarKeyboardTarget("2026-11-10", "ArrowUp", 30), "2026-11-03");
  assert.equal(getCalendarKeyboardTarget("2026-11-03", "ArrowUp", 30), "2026-11-01");
  assert.equal(getCalendarKeyboardTarget("2026-11-28", "ArrowDown", 30), "2026-11-30");
  assert.equal(getCalendarKeyboardTarget("2026-11-10", "End", 30), "2026-11-30");
  assert.equal(getCalendarKeyboardTarget("2026-11-01", "ArrowLeft", 30), null);
  assert.equal(getCalendarKeyboardTarget("2026-11-10", "Enter", 30), null);
});

const entryBase = { date: "2026-11-10", status: "pending" as const };
const bill = {
  ...entryBase,
  id: "bill:1",
  kind: "bill" as const,
  title: "Aluguel",
  amount: 1800,
  openAmount: 1800,
  billId: "1",
  detail: "Moradia",
  categoryIcon: null,
};
const invoice = {
  ...entryBase,
  id: "invoice-due:card:2026-11",
  kind: "invoiceDue" as const,
  title: "Nubank",
  amount: 500,
  openAmount: 200,
  cardId: "3b0d8b5e-58e4-4c4a-9a43-0d3c4a1f0f11",
  invoicePeriod: "2026-11",
  logo: null,
};
const task = {
  ...entryBase,
  id: "task:1",
  kind: "task" as const,
  title: "Declarar imposto",
  amount: null,
  openAmount: 0 as const,
  noteId: "6f7d4c1e-2b5a-4a3e-9c1d-8e2f3a4b5c6d",
};

test("a day's agenda is split by kind with explicit headings", () => {
  const groups = groupCalendarDayEntries([task, invoice, bill]);
  assert.deepEqual(
    groups.map((group) => [group.label, group.entries.length]),
    [
      ["Contas a pagar", 1],
      ["Faturas que vencem", 1],
      ["Tarefas com prazo", 1],
    ],
  );
});

test("entries say what they are and what their amount means", () => {
  assert.equal(describeCalendarEntry(invoice), "Fatura de novembro");
  assert.equal(describeCalendarEntry(bill), "Moradia");
  assert.equal(getCalendarEntryAmountCaption(invoice), "Restante");
  assert.equal(getCalendarEntryAmountCaption(bill), null);
  assert.equal(getCalendarCellEntryTitle(invoice), "Fatura Nubank");
  assert.equal(
    describeCalendarEntryCounts([bill, bill, invoice, task]),
    "2 contas, 1 fatura e 1 tarefa",
  );
});

test("day panel header splits the date into a calendar tile and a title", () => {
  assert.deepEqual(formatCalendarDayHeader("2026-11-30"), {
    month: "NOV",
    day: "30",
    weekday: "Segunda-feira",
    date: "30 de novembro",
  });
});

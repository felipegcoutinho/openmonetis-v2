import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  CalendarDayOutput,
  CalendarEntryOutput,
  CalendarOutput,
} from "@openmonetis/validators/calendar";

export const calendarWeekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** Entries shown inside a day cell of the month grid before the "+N" summary. */
export const calendarCellEntryLimit = 3;

export const calendarEntryKindLabels: Record<CalendarEntryOutput["kind"], string> = {
  bill: "Conta a pagar",
  invoiceDue: "Vencimento da fatura",
  invoiceClosing: "Fechamento da fatura",
  task: "Tarefa",
};

export function getCalendarEntryStatusLabel(entry: CalendarEntryOutput) {
  if (entry.status === "info") return null;
  if (entry.kind === "task") {
    return entry.status === "done"
      ? "Concluída"
      : entry.status === "overdue"
        ? "Atrasada"
        : "Pendente";
  }
  if (entry.status === "done") return "Pago";
  return entry.status === "overdue" ? "Em atraso" : "A vencer";
}

/** Order and headings of the kind groups in a day's agenda. */
const calendarEntryGroupOrder: Array<{ kind: CalendarEntryOutput["kind"]; label: string }> = [
  { kind: "bill", label: "Contas a pagar" },
  { kind: "invoiceDue", label: "Faturas que vencem" },
  { kind: "invoiceClosing", label: "Faturas que fecham" },
  { kind: "task", label: "Tarefas com prazo" },
];

/** A day's entries split by kind, so each list says explicitly what its items are. */
export function groupCalendarDayEntries(entries: CalendarEntryOutput[]) {
  return calendarEntryGroupOrder
    .map((group) => ({ ...group, entries: entries.filter((entry) => entry.kind === group.kind) }))
    .filter((group) => group.entries.length > 0);
}

function formatCalendarInvoiceMonth(period: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(`${period}-01`), { month: "long" });
}

/** Second line of an agenda row: what the entry refers to. */
export function describeCalendarEntry(entry: CalendarEntryOutput) {
  if (entry.kind === "bill") return entry.detail ?? calendarEntryKindLabels.bill;
  if (entry.kind === "task") return "Anotação";
  return `Fatura de ${formatCalendarInvoiceMonth(entry.invoicePeriod)}`;
}

/** What the amount of an agenda row means, when the status alone does not say it. */
export function getCalendarEntryAmountCaption(entry: CalendarEntryOutput) {
  if (entry.kind === "invoiceClosing") return "Total da fatura";
  if (entry.kind === "invoiceDue" && entry.status !== "done" && entry.openAmount < entry.amount) {
    return "Restante";
  }
  return null;
}

/** Short title inside a month-grid cell, naming the invoice event since both use the card name. */
export function getCalendarCellEntryTitle(entry: CalendarEntryOutput) {
  if (entry.kind === "invoiceDue") return `Fatura ${entry.title}`;
  // Short verb so the card name, the part that tells entries apart, survives the narrow cell.
  if (entry.kind === "invoiceClosing") return `Fecha ${entry.title}`;
  return entry.title;
}

/** Blank cells before the first day so it lands under its weekday (weeks start on Sunday). */
export function getCalendarLeadingBlankDays(period: string) {
  return dateOnlyToSafeInstant(`${period}-01`).getUTCDay();
}

export function formatCalendarDayNumber(date: string) {
  return String(Number(date.slice(8, 10)));
}

export function formatCalendarDayHeading(date: string) {
  const label = formatDateInBrazil(dateOnlyToSafeInstant(date), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

function capitalize(label: string) {
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

/** Parts of the day panel header: a calendar tile (month and day) beside weekday and date. */
export function formatCalendarDayHeader(date: string) {
  const instant = dateOnlyToSafeInstant(date);
  return {
    month: formatDateInBrazil(instant, { month: "short" })
      .replace(".", "")
      .toLocaleUpperCase("pt-BR"),
    day: formatCalendarDayNumber(date),
    weekday: capitalize(formatDateInBrazil(instant, { weekday: "long" })),
    date: formatDateInBrazil(instant, { day: "numeric", month: "long" }),
  };
}

/** Today when it belongs to the month, otherwise its first day with entries, or the 1st. */
export function getDefaultCalendarDate(calendar: CalendarOutput) {
  return (
    calendar.days.find((day) => day.isToday)?.date ??
    calendar.days.find((day) => day.entries.length > 0)?.date ??
    `${calendar.period}-01`
  );
}

export function describeCalendarDay(day: CalendarDayOutput, holidayLabel: string | null) {
  const parts = [formatCalendarDayHeading(day.date)];
  if (holidayLabel) parts.push(holidayLabel);
  const counts = describeCalendarEntryCounts(day.entries);
  if (counts) parts.push(counts);
  return parts.join(", ");
}

export const calendarLegendItems: Array<{
  status: CalendarEntryOutput["status"];
  label: string;
}> = [
  { status: "overdue", label: "Em atraso" },
  { status: "pending", label: "A vencer" },
  { status: "done", label: "Pago ou concluído" },
  { status: "info", label: "Fechamento (informativo)" },
];

const calendarKeyboardSteps: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Day reached from `date` with a grid navigation key, kept inside the month; `null` otherwise. */
export function getCalendarKeyboardTarget(date: string, key: string, daysInMonth: number) {
  const day = Number(date.slice(8, 10));
  const next =
    key === "Home"
      ? 1
      : key === "End"
        ? daysInMonth
        : key in calendarKeyboardSteps
          ? Math.min(daysInMonth, Math.max(1, day + (calendarKeyboardSteps[key] ?? 0)))
          : null;
  if (next === null || next === day) return null;
  return `${date.slice(0, 8)}${String(next).padStart(2, "0")}`;
}

const calendarEntryCountNouns: Record<CalendarEntryOutput["kind"], [string, string]> = {
  bill: ["conta", "contas"],
  invoiceDue: ["fatura", "faturas"],
  invoiceClosing: ["fechamento", "fechamentos"],
  task: ["tarefa", "tarefas"],
};

function joinWithAnd(parts: string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : (parts[0] ?? "");
}

/** "2 contas e 1 fatura": how many entries of each kind, in agenda order. */
export function describeCalendarEntryCounts(entries: CalendarEntryOutput[]) {
  return joinWithAnd(
    calendarEntryGroupOrder.flatMap(({ kind }) => {
      const count = entries.filter((entry) => entry.kind === kind).length;
      if (!count) return [];
      const [singular, plural] = calendarEntryCountNouns[kind];
      return [`${count} ${count === 1 ? singular : plural}`];
    }),
  );
}

/** Context lines for the month summary cards, naming what each number is made of. */
export function describeCalendarSummary(calendar: CalendarOutput) {
  const entries = calendar.days.flatMap((day) => day.entries);
  const payables = entries.filter((entry) => entry.kind === "bill" || entry.kind === "invoiceDue");
  const open = payables.filter((entry) => entry.status !== "done");
  const done = payables.filter((entry) => entry.status === "done");
  const overdue = entries.filter((entry) => entry.status === "overdue");
  return {
    open: open.length ? describeCalendarEntryCounts(open) : "Nada a pagar neste mês",
    done: payables.length
      ? `${done.length} de ${payables.length} ${payables.length === 1 ? "paga" : "pagas"}`
      : "Nada a pagar neste mês",
    // Bills, invoices and tasks are all feminine nouns in PT-BR.
    overdue: overdue.length
      ? `${describeCalendarEntryCounts(overdue)} ${overdue.length === 1 ? "vencida" : "vencidas"}`
      : "Tudo em dia",
  };
}

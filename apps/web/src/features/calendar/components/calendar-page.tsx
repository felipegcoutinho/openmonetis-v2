import type { CalendarDayOutput, CalendarOutput } from "@openmonetis/validators/calendar";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, CircleAlert, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { billsQueryOptions } from "@/features/bills/bills.queries";
import { BillPaymentDialog } from "@/features/bills/components/bill-payment-dialog";
import { cn } from "@/lib/utils";
import {
  describeCalendarSummary,
  formatCalendarDayHeader,
  getDefaultCalendarDate,
  groupCalendarDayEntries,
} from "../calendar.presentation";
import { calendarQueryOptions } from "../calendar.queries";
import { CalendarEntryItem } from "./calendar-entry-item";
import { CalendarMonthGrid, getCalendarHolidayLabel } from "./calendar-month-grid";

export function CalendarPage({
  period,
  onPeriodChange,
}: {
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const calendarQuery = useQuery(calendarQueryOptions(period));
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const billsQuery = useQuery({ ...billsQueryOptions(period), enabled: payingBillId !== null });
  const payingBill = billsQuery.data?.items.find((bill) => bill.id === payingBillId) ?? null;

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Finanças" },
              { label: "Calendário" },
            ]}
            description="Vencimentos, fechamentos de fatura e tarefas do mês, dia a dia."
            icon={<CalendarDays aria-hidden="true" className="size-5" />}
            title="Calendário"
          />
          <MonthNavigation onPeriodChange={onPeriodChange} period={period} />

          {calendarQuery.isLoading ? (
            <div aria-label="Carregando calendário" className="grid gap-4" role="status">
              <div className="grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-[28rem]" />
            </div>
          ) : null}

          {calendarQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar o calendário</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void calendarQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {calendarQuery.data ? (
            <CalendarContent
              calendar={calendarQuery.data}
              key={calendarQuery.data.period}
              onPayBill={setPayingBillId}
            />
          ) : null}
        </section>

        <BillPaymentDialog
          accounts={billsQuery.data?.accounts ?? []}
          bill={payingBill}
          key={payingBill?.id ?? "closed"}
          onOpenChange={(open) => {
            if (!open) setPayingBillId(null);
          }}
          open={Boolean(payingBill)}
        />
      </main>
    </ProtectedRoute>
  );
}

function CalendarContent({
  calendar,
  onPayBill,
}: {
  calendar: CalendarOutput;
  onPayBill: (billId: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(() => getDefaultCalendarDate(calendar));
  const selectedDay = calendar.days.find((day) => day.date === selectedDate);
  const daysWithEntries = calendar.days.filter((day) => day.entries.length > 0);
  const summary = describeCalendarSummary(calendar);

  return (
    <>
      <section aria-label="Resumo do mês" className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Wallet />}
          description={summary.open}
          label="A pagar no mês"
          value={<MoneyValue amount={calendar.summary.openAmount} />}
        />
        <StatCard
          icon={<CalendarCheck />}
          description={summary.done}
          label="Já pago"
          value={<MoneyValue amount={calendar.summary.paidAmount} />}
        />
        <StatCard
          icon={<CircleAlert />}
          description={summary.overdue}
          label="Em atraso"
          value={calendar.summary.overdueCount}
          valueClassName={calendar.summary.overdueCount ? "text-destructive" : undefined}
        />
      </section>

      <div className="hidden gap-4 md:grid xl:grid-cols-[minmax(0,1fr)_24rem]">
        <CalendarMonthGrid
          calendar={calendar}
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
        />
        {selectedDay ? (
          <div className="xl:sticky xl:top-20 xl:self-start">
            <CalendarDayPanel day={selectedDay} onPayBill={onPayBill} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:hidden">
        {daysWithEntries.length ? (
          daysWithEntries.map((day) => (
            <CalendarDayPanel day={day} key={day.date} onPayBill={onPayBill} />
          ))
        ) : (
          <CalendarEmptyState />
        )}
      </div>
    </>
  );
}

function CalendarDayPanel({
  day,
  onPayBill,
}: {
  day: CalendarDayOutput;
  onPayBill: (billId: string) => void;
}) {
  const holiday = getCalendarHolidayLabel(day.holiday);
  const header = formatCalendarDayHeader(day.date);
  const headingId = `calendar-day-${day.date}`;
  const dateId = `${headingId}-date`;

  return (
    <section aria-labelledby={`${headingId} ${dateId}`} className="grid content-start gap-3">
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="grid w-11 shrink-0 overflow-hidden rounded-lg bg-white text-center shadow-xs dark:bg-muted"
        >
          <span className="bg-primary py-0.5 font-semibold text-[0.625rem] text-primary-foreground leading-tight tracking-wide">
            {header.month}
          </span>
          <span className="py-1 font-semibold text-base tabular-nums leading-tight">
            {header.day}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold text-base leading-tight" id={headingId}>
              {header.weekday}
            </h2>
            {day.isToday ? (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground text-xs">
                Hoje
              </span>
            ) : null}
          </div>
          <p className="truncate text-muted-foreground text-sm" id={dateId}>
            {holiday ? `${header.date} · ${holiday}` : header.date}
          </p>
        </div>
        {day.openAmount > 0 ? (
          <div className="shrink-0 text-right">
            <MoneyValue amount={day.openAmount} className="font-medium text-sm" />
            <p className="text-muted-foreground text-xs">a pagar no dia</p>
          </div>
        ) : null}
      </div>
      {day.entries.length ? (
        // Columns shared by every row (logo, text, amount, action) through `subgrid`; one heading
        // per kind says what the rows below it are.
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] overflow-hidden rounded-lg border bg-card">
          {groupCalendarDayEntries(day.entries).map((group, index) => (
            <section
              aria-labelledby={`${headingId}-${group.kind}`}
              className={cn("col-span-4 grid grid-cols-subgrid", index > 0 && "border-t")}
              key={group.kind}
            >
              <h3
                className="col-span-4 flex items-center justify-between gap-3 bg-muted/40 px-3 py-1.5 font-medium text-muted-foreground text-xs"
                id={`${headingId}-${group.kind}`}
              >
                {group.label}
                <span className="font-normal tabular-nums">{group.entries.length}</span>
              </h3>
              <ul className="col-span-4 grid grid-cols-subgrid divide-y border-t">
                {group.entries.map((entry) => (
                  <CalendarEntryItem entry={entry} key={entry.id} onPayBill={onPayBill} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
          Nada previsto para este dia.
        </p>
      )}
    </section>
  );
}

function CalendarEmptyState() {
  return (
    <Card className="grid min-h-48 place-items-center border p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-4 font-medium">Nada previsto neste mês</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Contas com vencimento, faturas de cartão e tarefas com prazo aparecem aqui.
        </p>
      </div>
    </Card>
  );
}

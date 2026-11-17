import type { CalendarOutput } from "@openmonetis/validators/calendar";
import { type KeyboardEvent, useRef } from "react";
import { MoneyValue } from "@/components/money-value";
import { nationalHolidayLabels } from "@/features/due-date-rules/due-date-rules.presentation";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  calendarCellEntryLimit,
  calendarLegendItems,
  calendarWeekdayLabels,
  describeCalendarDay,
  formatCalendarDayNumber,
  getCalendarCellEntryTitle,
  getCalendarKeyboardTarget,
  getCalendarLeadingBlankDays,
} from "../calendar.presentation";
import { CalendarEntryLogo } from "./calendar-entry-logo";
import { CalendarStatusIcon } from "./calendar-status-icon";

export function getCalendarHolidayLabel(holiday: CalendarOutput["days"][number]["holiday"]) {
  if (!holiday) return null;
  return holiday.kind === "national" ? nationalHolidayLabels[holiday.id] : "Feriado";
}

export function CalendarMonthGrid({
  calendar,
  selectedDate,
  onSelectDate,
}: {
  calendar: CalendarOutput;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const leadingBlankDays = getCalendarLeadingBlankDays(calendar.period);
  const trailingBlankDays = (7 - ((leadingBlankDays + calendar.days.length) % 7)) % 7;

  // Arrow keys move the selection like a native date grid; only the selected day is a tab stop.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const target = getCalendarKeyboardTarget(date, event.key, calendar.days.length);
    if (!target) return;
    event.preventDefault();
    onSelectDate(target);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  }

  return (
    <div className="grid content-start gap-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <div aria-hidden="true" className="grid grid-cols-7 border-b">
          {calendarWeekdayLabels.map((weekday) => (
            <span
              className="px-2 py-2 text-center font-mono text-muted-foreground text-xs"
              key={weekday}
            >
              {weekday}
            </span>
          ))}
        </div>
        <p className="sr-only">
          {`Dias de ${formatPeriod(calendar.period)}. Use as setas para mudar o dia.`}
        </p>
        <div className="-mb-px grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0" ref={gridRef}>
          {Array.from({ length: leadingBlankDays }, (_, index) => (
            <span
              aria-hidden="true"
              className="min-h-28 border-r border-b"
              // biome-ignore lint/suspicious/noArrayIndexKey: blank cells have no identity.
              key={index}
            />
          ))}
          {calendar.days.map((day) => {
            const selected = day.date === selectedDate;
            const holiday = getCalendarHolidayLabel(day.holiday);
            const hiddenCount = Math.max(0, day.entries.length - calendarCellEntryLimit);
            return (
              <button
                aria-label={describeCalendarDay(day, holiday)}
                aria-pressed={selected}
                className={cn(
                  "relative flex min-h-28 min-w-0 flex-col gap-1.5 border-r border-b p-2 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  !day.isBusinessDay && "bg-muted/30",
                  selected &&
                    "z-[1] bg-primary/5 ring-2 ring-primary ring-inset hover:bg-primary/10",
                )}
                data-date={day.date}
                key={day.date}
                onClick={() => onSelectDate(day.date)}
                onKeyDown={(event) => handleKeyDown(event, day.date)}
                tabIndex={selected ? 0 : -1}
                title={holiday ?? undefined}
                type="button"
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums",
                      day.isToday && "bg-primary font-medium text-primary-foreground",
                      !day.isToday && !day.isBusinessDay && "text-muted-foreground",
                    )}
                  >
                    {formatCalendarDayNumber(day.date)}
                  </span>
                  {day.openAmount > 0 ? (
                    <span className="truncate" title="Total a pagar no dia">
                      <MoneyValue
                        amount={day.openAmount}
                        className="font-medium text-2xs text-foreground tabular-nums"
                      />
                    </span>
                  ) : null}
                </span>
                {holiday ? (
                  <span className="truncate text-2xs text-muted-foreground">{holiday}</span>
                ) : null}
                <span className="grid min-w-0 gap-1">
                  {day.entries.slice(0, calendarCellEntryLimit).map((entry) => (
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-2 text-2xs leading-tight",
                        entry.status === "done" || entry.status === "info"
                          ? "text-muted-foreground"
                          : "text-foreground",
                        entry.status === "overdue" && "text-destructive",
                      )}
                      key={entry.id}
                    >
                      {/* Logo identifies the entry; the icon badge on its corner carries the status, so
                          the name keeps the whole width of the narrow cell. */}
                      <span aria-hidden="true" className="relative shrink-0">
                        <CalendarEntryLogo entry={entry} size={16} />
                        <span className="absolute -right-1.5 -bottom-1 grid size-3 place-items-center rounded-full bg-card">
                          <CalendarStatusIcon className="size-2.5" status={entry.status} />
                        </span>
                      </span>
                      <span className="min-w-0 truncate">{getCalendarCellEntryTitle(entry)}</span>
                    </span>
                  ))}
                  {hiddenCount ? (
                    <span className="pl-6 text-2xs text-muted-foreground">
                      +{hiddenCount} {hiddenCount === 1 ? "item" : "itens"}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {Array.from({ length: trailingBlankDays }, (_, index) => (
            <span
              aria-hidden="true"
              className="min-h-28 border-r border-b"
              // biome-ignore lint/suspicious/noArrayIndexKey: blank cells have no identity.
              key={`trailing-${index}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-muted-foreground text-xs">
        <ul aria-label="Situação dos itens" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <li aria-hidden="true" className="font-medium text-foreground">
            Situação:
          </li>
          {calendarLegendItems.map((item) => (
            <li className="flex items-center gap-1.5" key={item.status}>
              <CalendarStatusIcon status={item.status} />
              {item.label}
            </li>
          ))}
        </ul>
        <p>
          <span className="font-medium text-foreground">R$ no topo do dia:</span> total a pagar no
          dia
        </p>
      </div>
    </div>
  );
}

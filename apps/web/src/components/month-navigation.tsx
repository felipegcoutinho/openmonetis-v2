import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  isCalendarPeriod,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function periodToDate(period: string) {
  return periodToSafeInstant(period);
}

function dateToPeriod(date: Date) {
  return getCurrentPeriodInBrazil(date);
}

function shiftPeriod(period: string, amount: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  return getCurrentPeriodInBrazil(date);
}

export function getCurrentPeriod() {
  return getCurrentPeriodInBrazil();
}

function formatPeriod(period: string) {
  const label = formatDateInBrazil(periodToDate(period), {
    month: "long",
    year: "numeric",
  });

  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

type MonthNavigationProps = {
  className?: string;
  onPeriodChange: (period: string) => void;
  period: string;
};

export function MonthNavigation({ className, onPeriodChange, period }: MonthNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentPeriod = getCurrentPeriod();
  const selectedPeriod = isCalendarPeriod(period) ? period : currentPeriod;
  const periodLabel = formatPeriod(selectedPeriod);

  function selectPeriod(nextPeriod: string) {
    onPeriodChange(nextPeriod);
    setIsOpen(false);
  }

  return (
    <nav
      aria-label="Navegação por mês"
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border bg-card/80 px-3 py-3 shadow-xs backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex min-w-0 items-center">
        <Button
          aria-label="Mês anterior"
          onClick={() => selectPeriod(shiftPeriod(selectedPeriod, -1))}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        <Popover onOpenChange={setIsOpen} open={isOpen}>
          <PopoverTrigger
            aria-label={`Selecionar mês. Mês atual: ${periodLabel}`}
            className="inline-flex h-8 min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand-strong" />
            <span className="truncate">{periodLabel}</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto bg-popover/80 p-0 backdrop-blur-sm">
            <MonthPicker
              key={selectedPeriod}
              onMonthSelect={(date) => selectPeriod(dateToPeriod(date))}
              selectedMonth={periodToDate(selectedPeriod)}
            />
          </PopoverContent>
        </Popover>

        <Button
          aria-label="Próximo mês"
          onClick={() => selectPeriod(shiftPeriod(selectedPeriod, 1))}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {selectedPeriod !== currentPeriod ? (
        <Button onClick={() => selectPeriod(currentPeriod)} size="sm" type="button" variant="ghost">
          <RotateCcw aria-hidden="true" />
          <span className="hidden sm:inline">Voltar ao mês atual</span>
          <span className="sm:hidden">Hoje</span>
        </Button>
      ) : null}
    </nav>
  );
}

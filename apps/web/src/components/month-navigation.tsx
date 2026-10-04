import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  isCalendarPeriod,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
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

function formatCompactPeriod(period: string) {
  const label = formatDateInBrazil(periodToDate(period), {
    month: "short",
    year: "numeric",
  }).replace(" de ", " ");

  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

type MonthNavigationProps = {
  className?: string;
  compact?: boolean;
  onPeriodChange: (period: string) => void;
  period: string;
};

export function MonthNavigation({
  className,
  compact = false,
  onPeriodChange,
  period,
}: MonthNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentPeriod = getCurrentPeriod();
  const selectedPeriod = isCalendarPeriod(period) ? period : currentPeriod;
  const periodLabel = formatPeriod(selectedPeriod);

  function selectPeriod(nextPeriod: string) {
    onPeriodChange(nextPeriod);
    setIsOpen(false);
  }

  const monthPicker = (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger
        aria-label={`Selecionar mês. Mês selecionado: ${periodLabel}`}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 rounded-md px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
          compact ? "h-9 border bg-card shadow-xs" : "h-8",
        )}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-brand-strong" />
        <span className="truncate">
          {compact ? (
            formatCompactPeriod(selectedPeriod)
          ) : (
            <>
              <span className="max-[379px]:hidden">{periodLabel}</span>
              <span className="hidden max-[379px]:inline">
                {formatCompactPeriod(selectedPeriod)}
              </span>
            </>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        title="Selecionar mês"
        align={compact ? "end" : "center"}
        className="w-auto bg-popover/80 p-0 backdrop-blur-sm"
      >
        <MonthPicker
          key={selectedPeriod}
          onMonthSelect={(date) => selectPeriod(dateToPeriod(date))}
          selectedMonth={periodToDate(selectedPeriod)}
        />
      </PopoverContent>
    </Popover>
  );

  if (compact) {
    return <div className={cn("min-w-0", className)}>{monthPicker}</div>;
  }

  return (
    <nav
      data-mobile-month-navigation
      aria-label="Navegação por mês"
      className={cn(
        "relative flex w-full items-center justify-center rounded-lg border bg-card/80 px-3 py-3 shadow-xs backdrop-blur-sm md:justify-between md:gap-2",
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

        {monthPicker}

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
        <Button
          aria-label="Voltar ao mês atual"
          className="absolute right-3 md:static md:w-auto md:px-2.5"
          onClick={() => selectPeriod(currentPeriod)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
          <span className="hidden md:inline">Voltar ao mês atual</span>
        </Button>
      ) : null}
    </nav>
  );
}

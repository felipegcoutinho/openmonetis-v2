import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
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
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";

function formatCompactPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
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
  const currentPeriod = getCurrentPeriodInBrazil();
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
          "inline-flex min-w-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium tabular-nums outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring",
          compact ? "h-9 border bg-card" : "h-8",
        )}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
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
        className="w-auto p-0"
      >
        <MonthPicker
          key={selectedPeriod}
          onMonthSelect={(date) => selectPeriod(getCurrentPeriodInBrazil(date))}
          selectedMonth={periodToSafeInstant(selectedPeriod)}
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
        "material sticky top-(--page-sticky-top) z-20 flex w-full items-center justify-center rounded-lg border px-1 py-1 md:w-fit md:justify-start md:gap-1",
        className,
      )}
    >
      <div className="flex min-w-0 items-center">
        <Button
          aria-label="Mês anterior"
          onClick={() => selectPeriod(addMonthsToPeriod(selectedPeriod, -1))}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        {monthPicker}

        <Button
          aria-label="Próximo mês"
          onClick={() => selectPeriod(addMonthsToPeriod(selectedPeriod, 1))}
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
          className="absolute right-1.5 md:static md:w-auto md:gap-2 md:px-3"
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

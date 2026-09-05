import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PeriodPickerProps = {
  "aria-invalid"?: boolean;
  className?: string;
  id?: string;
  onChange: (period: string) => void;
  value: string;
};

export function PeriodPicker({
  "aria-invalid": ariaInvalid,
  className,
  id,
  onChange,
  value,
}: PeriodPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-between border-input bg-popover px-2.5 font-normal focus-visible:ring-ring/50",
              className,
            )}
            data-slot="period-picker-trigger"
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatPeriod(value)}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto bg-popover/85 p-0 backdrop-blur-md">
        <MonthPicker
          key={value}
          onMonthSelect={(date) => {
            onChange(dateToPeriod(date));
            setOpen(false);
          }}
          selectedMonth={periodToDate(value)}
        />
      </PopoverContent>
    </Popover>
  );
}

function periodToDate(period: string) {
  return periodToSafeInstant(period);
}

function dateToPeriod(date: Date) {
  return getCurrentPeriodInBrazil(date);
}

function formatPeriod(period: string) {
  const label = formatDateInBrazil(periodToDate(period), { month: "long", year: "numeric" });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

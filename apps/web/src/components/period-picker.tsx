import { getCurrentPeriodInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";
import { CalendarDays, ChevronDown } from "lucide-react";
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
      <PopoverContent
        title="Selecionar mês"
        align="start"
        className="w-auto bg-popover/80 p-0 backdrop-blur-sm"
      >
        <MonthPicker
          key={value}
          onMonthSelect={(date) => {
            onChange(getCurrentPeriodInBrazil(date));
            setOpen(false);
          }}
          selectedMonth={periodToSafeInstant(value)}
        />
      </PopoverContent>
    </Popover>
  );
}

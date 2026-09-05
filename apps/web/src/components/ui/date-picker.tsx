import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentDateInBrazil,
  getCurrentYearInBrazil,
} from "@openmonetis/shared/date-time";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = dateOnlyToSafeInstant(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function serializeDate(date?: Date) {
  if (!date) return "";
  return getCurrentDateInBrazil(date);
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date ? formatDateInBrazil(date, { day: "numeric", month: "long", year: "numeric" }) : "";
}

export function DatePicker({
  "aria-invalid": ariaInvalid,
  className,
  disabled,
  id,
  max,
  min,
  onChange,
  placeholder = "Selecione uma data",
  value,
}: {
  "aria-invalid"?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const [month, setMonth] = useState(selected);
  const maxDate = max ? parseDate(max) : undefined;
  const minDate = min ? parseDate(min) : undefined;

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        if (nextOpen) setMonth(selected);
        setOpen(nextOpen);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-between border-input bg-popover px-2.5 font-normal focus-visible:ring-ring/50",
              !value && "text-muted-foreground",
              className,
            )}
            data-slot="date-picker-trigger"
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        <span>{formatDate(value) || placeholder}</span>
        <CalendarDays className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          disabled={(date) => {
            const value = getCurrentDateInBrazil(date);
            return Boolean((min && value < min) || (max && value > max));
          }}
          endMonth={maxDate ?? new Date(Date.UTC(getCurrentYearInBrazil() + 10, 11, 1, 12))}
          locale={ptBR}
          mode="single"
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            const nextDate = date ?? selected;
            if (!nextDate) return;
            onChange(serializeDate(nextDate));
            setOpen(false);
          }}
          selected={selected}
          startMonth={minDate ?? new Date(Date.UTC(2000, 0, 1, 12))}
        />
      </PopoverContent>
    </Popover>
  );
}

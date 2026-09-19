import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MonthPicker } from "@/components/ui/month-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cardInvoicePeriodQueryOptions } from "@/features/cards/cards.queries";

function periodToDate(period: string) {
  return periodToSafeInstant(period);
}

function dateToPeriod(date: Date) {
  return getCurrentPeriodInBrazil(date);
}

function displayPeriod(period: string) {
  return formatDateInBrazil(periodToDate(period), { month: "short", year: "numeric" });
}

export function InvoicePeriodPicker({
  cardId = "",
  onChange,
  purchaseDate = "",
  value,
}: {
  cardId?: string;
  onChange: (value: string) => void;
  purchaseDate?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const quote = useQuery(cardInvoicePeriodQueryOptions(cardId, purchaseDate));
  const effectivePeriod = value || quote.data?.period || purchaseDate.slice(0, 7);
  const periodPrefix = value ? "Fatura: " : "Previsão: ";
  return (
    <div className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap pl-1">
      {effectivePeriod ? (
        <span className="text-muted-foreground text-xs">{periodPrefix}</span>
      ) : null}
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger className="rounded-sm font-medium text-brand-strong text-xs lowercase underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {effectivePeriod
            ? `${displayPeriod(effectivePeriod)} · alterar`
            : quote.isLoading
              ? "Calculando fatura..."
              : "Selecione a data para calcular a fatura"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto bg-popover/80 p-0 backdrop-blur-sm">
          <MonthPicker
            onMonthSelect={(date) => {
              onChange(dateToPeriod(date));
              setOpen(false);
            }}
            selectedMonth={effectivePeriod ? periodToDate(effectivePeriod) : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

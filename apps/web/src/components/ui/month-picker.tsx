import { getCurrentYearInBrazil } from "@openmonetis/shared/date-time";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthPicker({
  className,
  onMonthSelect,
  selectedMonth,
}: {
  className?: string;
  onMonthSelect: (date: Date) => void;
  selectedMonth?: Date;
}) {
  const [visibleYear, setVisibleYear] = useState(
    selectedMonth?.getUTCFullYear() ?? getCurrentYearInBrazil(),
  );

  return (
    <div className={cn("w-72 p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <Button
          aria-label="Ano anterior"
          onClick={() => setVisibleYear((year) => year - 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-medium text-sm">{visibleYear}</span>
        <Button
          aria-label="Próximo ano"
          onClick={() => setVisibleYear((year) => year + 1)}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {months.map((month, index) => {
          const selected =
            selectedMonth?.getUTCFullYear() === visibleYear &&
            selectedMonth.getUTCMonth() === index;
          return (
            <Button
              aria-pressed={selected}
              className={cn(
                "font-normal",
                !selected && "hover:border-brand-strong/40 hover:bg-accent hover:text-brand-strong",
              )}
              key={month}
              onClick={() => onMonthSelect(new Date(Date.UTC(visibleYear, index, 1, 12)))}
              type="button"
              variant={selected ? "default" : "ghost"}
            >
              {month}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

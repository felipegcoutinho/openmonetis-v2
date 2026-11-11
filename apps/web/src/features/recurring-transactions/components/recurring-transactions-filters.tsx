import type { RecurringTransactionsSearch } from "@openmonetis/validators/recurring-transactions";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SearchInput } from "@/components/search-input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";

const statusLabels = {
  active: "Ativas",
  paused: "Pausadas",
  ended: "Encerradas",
  all: "Todas",
} as const;

type StatusFilter = keyof typeof statusLabels;

export function RecurringTransactionsFilters({
  search,
  counts,
  onChange,
}: {
  search: RecurringTransactionsSearch;
  /** Series per situation, shown next to each tab so the summary does not repeat them. */
  counts: Record<StatusFilter, number>;
  onChange: (patch: Partial<RecurringTransactionsSearch>) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
      <Tabs
        className="min-w-0"
        value={search.status}
        onValueChange={(value) => {
          if (typeof value === "string" && value in statusLabels)
            onChange({ status: value as StatusFilter });
        }}
      >
        <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <TabsList aria-label="Situação das recorrências" className="min-w-max" variant="line">
            {(Object.keys(statusLabels) as StatusFilter[]).map((status) => (
              <TabsTrigger key={status} value={status}>
                {statusLabels[status]}
                <span className="text-muted-foreground text-xs tabular-nums">{counts[status]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] lg:ml-auto">
        <Select
          value={search.paymentMethod}
          onValueChange={(value) => {
            if (value === "all" || (value && value in paymentMethodLabels))
              onChange({ paymentMethod: value as RecurringTransactionsSearch["paymentMethod"] });
          }}
        >
          <SelectTrigger aria-label="Meio de pagamento ou recebimento" className="w-full sm:w-44">
            <SelectValue>
              {search.paymentMethod === "all"
                ? "Todos os meios"
                : paymentMethodLabels[search.paymentMethod]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meios</SelectItem>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput
          aria-label="Buscar lançamentos recorrentes"
          containerClassName="lg:w-60"
          placeholder="Buscar descrição, conta ou categoria"
          value={search.q}
          maxLength={160}
          onValueChange={(q) => onChange({ q })}
        />
      </div>
    </div>
  );
}

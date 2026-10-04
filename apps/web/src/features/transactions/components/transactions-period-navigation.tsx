import { MonthNavigation } from "@/components/month-navigation";

import { Button } from "@/components/ui/button";

import { formatTransactionFilterDate, type TransactionsSearch } from "../transactions.presentation";

import type { TransactionsScreenProps } from "./transactions-screen.types";

export function TransactionsPeriodNavigation({
  urlSearch,
  onSearchChange,
  onPeriodChange,
  period,
}: {
  urlSearch: TransactionsSearch;
  onSearchChange: TransactionsScreenProps["onSearchChange"];
  onPeriodChange: TransactionsScreenProps["onPeriodChange"];
  period: string;
}) {
  return urlSearch.dateStart || urlSearch.dateEnd ? (
    <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
      <p className="text-sm font-medium">
        Intervalo:{" "}
        {urlSearch.dateStart ? formatTransactionFilterDate(urlSearch.dateStart) : "desde o início"}{" "}
        até {urlSearch.dateEnd ? formatTransactionFilterDate(urlSearch.dateEnd) : "a última data"}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onSearchChange({ dateStart: undefined, dateEnd: undefined, page: undefined })
        }
      >
        Voltar ao mês selecionado
      </Button>
    </div>
  ) : (
    <MonthNavigation
      className="sticky top-20 z-20"
      onPeriodChange={(nextPeriod) => {
        onPeriodChange?.(nextPeriod);
      }}
      period={period}
    />
  );
}

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
    <div className="material sticky top-(--page-sticky-top) z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border py-1 pr-1 pl-4">
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
      onPeriodChange={(nextPeriod) => {
        onPeriodChange?.(nextPeriod);
      }}
      period={period}
    />
  );
}

import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ListOrdered, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatCompactDate } from "@/features/transactions/transactions.presentation";
import { transactionsQueryOptions } from "@/features/transactions/transactions.queries";
import { cn } from "@/lib/utils";
import { DashboardWidget } from "./dashboard-widget";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetRow } from "./dashboard-widget-row";

const maximumVisibleTransactions = 3;

export function DashboardRecentTransactionsWidget({ period }: { period: string }) {
  const query = useQuery(
    transactionsQueryOptions({ page: 1, pageSize: 5, period, sort: "recent" }),
  );
  const transactions = query.data?.items.slice(0, maximumVisibleTransactions) ?? [];

  return (
    <DashboardWidget
      className="h-auto min-h-0"
      description="Últimos lançamentos do período"
      footer={
        query.data && query.data.total > 0 ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ period }}
            to="/transactions"
          >
            Ver lançamentos <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<ListOrdered aria-hidden="true" />}
      title="Movimentação recente"
    >
      {query.isPending ? <RecentTransactionsLoading /> : null}
      {query.isError ? (
        <div className="grid min-h-36 place-items-center py-6 text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar os lançamentos</p>
            <Button
              className="mt-3"
              onClick={() => void query.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {query.data && !query.isError ? (
        transactions.length > 0 ? (
          <ul className="divide-y">
            {transactions.map((transaction) => (
              <RecentTransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </ul>
        ) : (
          <div className="grid min-h-32 place-items-center py-6 text-center">
            <div>
              <ListOrdered aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-medium text-sm">Nenhum lançamento neste mês</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Suas movimentações recentes aparecerão aqui.
              </p>
            </div>
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function RecentTransactionRow({ transaction }: { transaction: TransactionOutput }) {
  const visibleAmount = transaction.allocation?.amount ?? transaction.amount;
  const showPositiveSign = transaction.type === "income" || visibleAmount > 0;

  return (
    <DashboardWidgetRow>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
          transaction.type === "income" && "bg-success/10 text-success",
          transaction.type === "transfer" && "bg-info/10 text-info",
        )}
      >
        <CategoryIcon aria-hidden="true" className="size-4" name={transaction.categoryIcon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{transaction.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {formatCompactDate(transaction.purchaseDate)}
          {transaction.categoryName ? ` · ${transaction.categoryName}` : ""}
        </p>
      </div>
      <MoneyValue
        amount={visibleAmount}
        className={cn(
          "shrink-0 font-medium text-sm",
          transaction.type === "income" && "text-success",
          transaction.type === "transfer" && "text-info",
        )}
        showPositiveSign={showPositiveSign}
      />
    </DashboardWidgetRow>
  );
}

function RecentTransactionsLoading() {
  return (
    <div aria-label="Carregando lançamentos recentes" className="grid gap-2 py-2" role="status">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

import type { DashboardAccountOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, Eye, EyeOff, Landmark, RefreshCw, WalletCards } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { accountTypeLabels } from "@/features/accounts/accounts.presentation";
import { cn } from "@/lib/utils";
import { formatAccountBalanceShare, getAccountBalanceShare } from "../dashboard.presentation";
import { dashboardAccountsQueryOptions } from "../dashboard.queries";
import { DashboardItemLinkArrow } from "./dashboard-item-link-arrow";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetRow } from "./dashboard-widget-row";

const maximumVisibleAccounts = 4;

export function MyAccountsWidget({ period }: { period: string }) {
  const accountsQuery = useQuery(dashboardAccountsQueryOptions(period));
  const [showExcluded, setShowExcluded] = useState(false);
  const accounts = accountsQuery.data?.items ?? [];
  const excludedCount = accounts.filter((account) => account.excludeFromBalance).length;
  const consideredBalanceMagnitude = accounts.reduce(
    (total, account) => (account.excludeFromBalance ? total : total + Math.abs(account.balance)),
    0,
  );
  const visibleAccounts = (
    showExcluded ? accounts : accounts.filter((account) => !account.excludeFromBalance)
  ).slice(0, maximumVisibleAccounts);
  return (
    <DashboardWidget
      action={
        excludedCount > 0 ? (
          <Tooltip>
            <TooltipTrigger
              aria-label={
                showExcluded ? "Ocultar contas fora do saldo" : "Mostrar contas fora do saldo"
              }
              render={
                <Button
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setShowExcluded((value) => !value)}
                />
              }
            >
              {showExcluded ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </TooltipTrigger>
            <TooltipContent>
              {showExcluded
                ? "Ocultar contas fora do saldo"
                : `Mostrar ${excludedCount} ${excludedCount === 1 ? "conta" : "contas"} fora do saldo`}
            </TooltipContent>
          </Tooltip>
        ) : null
      }
      description="Saldos com suas movimentações confirmadas"
      footer={
        accounts.length > 0 ? (
          <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/accounts">
            Ver contas
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<WalletCards aria-hidden="true" />}
      title="Minhas contas"
    >
      {accountsQuery.isLoading ? <AccountsLoading /> : null}
      {accountsQuery.isError ? (
        <AccountsError onRetry={() => void accountsQuery.refetch()} />
      ) : null}
      {accountsQuery.data && !accountsQuery.isError ? (
        <div className="flex flex-1 flex-col">
          {accounts.length > 0 ? (
            <div className="flex items-end justify-between gap-4 pb-4 pt-2">
              <div>
                <p className="text-muted-foreground text-xs">Saldo das contas incluídas</p>
                <MoneyValue
                  amount={accountsQuery.data.totalBalance}
                  className={cn(
                    "mt-1 font-medium text-2xl",
                    accountsQuery.data.totalBalance < 0 && "text-destructive",
                  )}
                />
              </div>
            </div>
          ) : null}

          {accounts.length === 0 ? (
            <AccountsEmpty />
          ) : visibleAccounts.length === 0 ? (
            <div className="grid flex-1 place-items-center py-8 text-center">
              <div className="max-w-xs">
                <EyeOff aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 font-medium text-sm">Contas fora do saldo estão ocultas</p>
                <Button
                  className="mt-3"
                  onClick={() => setShowExcluded(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Mostrar contas
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {visibleAccounts.map((account) => (
                <AccountRow
                  account={account}
                  balanceShare={getAccountBalanceShare(account.balance, consideredBalanceMagnitude)}
                  key={account.id}
                  period={period}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </DashboardWidget>
  );
}

function AccountRow({
  account,
  balanceShare,
  period,
}: {
  account: DashboardAccountOutput;
  balanceShare: number;
  period: string;
}) {
  const formattedBalanceShare = formatAccountBalanceShare(balanceShare);

  return (
    <DashboardWidgetRow>
      {account.logo ? (
        <Image
          alt={`Logo de ${account.name}`}
          className="size-9 shrink-0 rounded-full object-contain"
          height={36}
          layout="fixed"
          src={account.logo}
          width={36}
        />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground text-xs">
          {account.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link
          className="group inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm font-medium text-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          params={{ accountId: account.id }}
          search={{ period }}
          to="/accounts/$accountId"
        >
          <span className="truncate">{account.name}</span>
          <DashboardItemLinkArrow />
        </Link>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className="truncate text-muted-foreground text-xs">
            {accountTypeLabels[account.type]}
          </span>
          {account.excludeFromBalance ? (
            <Badge className="h-4 px-1.5 text-[10px]" variant="secondary">
              Fora do saldo
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <MoneyValue
          amount={account.balance}
          className={cn("font-medium font-sans text-sm", account.balance < 0 && "text-destructive")}
        />
        {!account.excludeFromBalance ? (
          <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
            {formattedBalanceShare}% entre as contas
          </p>
        ) : null}
      </div>
    </DashboardWidgetRow>
  );
}

function AccountsLoading() {
  return (
    <div aria-label="Carregando contas" className="grid gap-4" role="status">
      <Skeleton className="h-8 w-40" />
      {["first", "second", "third"].map((key) => (
        <div className="flex items-center gap-3" key={key}>
          <Skeleton className="size-9 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function AccountsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid flex-1 place-items-center py-8 text-center">
      <div>
        <p className="font-medium text-sm">Não foi possível carregar suas contas</p>
        <Button className="mt-3" onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function AccountsEmpty() {
  return (
    <DashboardWidgetEmptyState
      description="Os saldos das suas contas aparecerão aqui."
      icon={<Landmark aria-hidden="true" />}
      title="Nenhuma conta cadastrada"
    />
  );
}

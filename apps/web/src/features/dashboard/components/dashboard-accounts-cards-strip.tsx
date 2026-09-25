import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { CreditCard, Landmark, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cardInvoiceStatusLabels } from "@/features/cards/cards.presentation";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { dashboardAccountsQueryOptions } from "../dashboard.queries";

export function DashboardAccountsCardsStrip({ period }: { period: string }) {
  const accountsQuery = useQuery(dashboardAccountsQueryOptions(period));
  const cardsQuery = useQuery(cardsQueryOptions(period));
  const accounts = accountsQuery.data?.items ?? [];
  const cards = cardsQuery.data ?? [];
  const isPending = accountsQuery.isPending || cardsQuery.isPending;
  const isError = accountsQuery.isError && cardsQuery.isError;

  function retry() {
    void Promise.all([accountsQuery.refetch(), cardsQuery.refetch()]);
  }

  return (
    <section aria-labelledby="accounts-cards-title" className="grid gap-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-heading font-medium" id="accounts-cards-title">
            Contas e cartões
          </h2>
          <p className="text-muted-foreground text-xs">Seus saldos e faturas em um só lugar</p>
        </div>
        <Link className="shrink-0 font-medium text-primary text-xs" to="/accounts">
          Ver tudo
        </Link>
      </div>

      {isPending ? (
        <div className="flex gap-3 overflow-hidden" role="status">
          <Skeleton className="h-28 min-w-52 rounded-xl" />
          <Skeleton className="h-28 min-w-52 rounded-xl" />
          <span className="sr-only">Carregando contas e cartões…</span>
        </div>
      ) : null}

      {isError ? (
        <div className="grid min-h-28 place-items-center rounded-xl border bg-card p-4 text-center">
          <Button onClick={retry} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" /> Tentar novamente
          </Button>
        </div>
      ) : null}

      {!isPending && !isError ? (
        accounts.length + cards.length > 0 ? (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {accounts.map((account) => (
              <Link
                className="grid min-h-28 min-w-52 snap-start content-between rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/35"
                key={account.id}
                params={{ accountId: account.id }}
                search={{ period }}
                to="/accounts/$accountId"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {account.logo ? (
                    <Image
                      alt=""
                      className="size-8 rounded-full object-contain"
                      height={32}
                      layout="fixed"
                      src={account.logo}
                      width={32}
                    />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                      <Landmark aria-hidden="true" className="size-4" />
                    </span>
                  )}
                  <span className="truncate font-medium text-sm">{account.name}</span>
                </span>
                <span>
                  <span className="block text-muted-foreground text-[0.7rem]">
                    Saldo disponível
                  </span>
                  <MoneyValue amount={account.balance} className="font-medium text-lg" />
                </span>
              </Link>
            ))}
            {cards.map((card) => (
              <Link
                className="grid min-h-28 min-w-52 snap-start content-between rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/35"
                key={card.id}
                params={{ cardId: card.id }}
                search={{ period }}
                to="/cards/$cardId"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {card.logo ? (
                    <Image
                      alt=""
                      className="size-8 rounded-full object-contain"
                      height={32}
                      layout="fixed"
                      src={card.logo}
                      width={32}
                    />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-info/10 text-info">
                      <CreditCard aria-hidden="true" className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-sm">{card.name}</span>
                  <span className="text-muted-foreground text-[0.65rem]">
                    {cardInvoiceStatusLabels[card.invoiceSummary.status]}
                  </span>
                </span>
                <span>
                  <span className="block text-muted-foreground text-[0.7rem]">Fatura atual</span>
                  <MoneyValue amount={card.invoiceSummary.amount} className="font-medium text-lg" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card/60 p-5 text-center">
            <p className="font-medium text-sm">Nenhuma conta ou cartão cadastrado</p>
            <Link className="mt-1 inline-block text-primary text-xs" to="/accounts">
              Cadastrar agora
            </Link>
          </div>
        )
      ) : null}
    </section>
  );
}

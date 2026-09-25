import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Barcode, CheckCircle2, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { billsQueryOptions } from "@/features/bills/bills.queries";
import { inboxSnapshotQueryOptions } from "@/features/inbox/inbox.queries";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetRow } from "./dashboard-widget-row";

export function DashboardAttentionWidget({ period }: { period: string }) {
  const billsQuery = useQuery(billsQueryOptions(period));
  const inboxQuery = useQuery(inboxSnapshotQueryOptions(1));
  const openBillsCount = billsQuery.data?.items.filter((bill) => !bill.isSettled).length ?? 0;
  const pendingInboxCount = inboxQuery.data?.pendingCount ?? 0;
  const attentionCount = openBillsCount + pendingInboxCount;
  const isPending = billsQuery.isPending || inboxQuery.isPending;
  const hasNoAvailableData = billsQuery.isError && inboxQuery.isError;
  const hasPartialError = !hasNoAvailableData && (billsQuery.isError || inboxQuery.isError);

  function retry() {
    void Promise.all([billsQuery.refetch(), inboxQuery.refetch()]);
  }

  return (
    <DashboardWidget
      action={attentionCount > 0 ? <Badge variant="secondary">{attentionCount}</Badge> : null}
      className="h-auto min-h-0"
      description="Pendências que podem exigir uma ação"
      icon={<CheckCircle2 aria-hidden="true" />}
      title="Precisa da sua atenção"
    >
      {isPending ? <AttentionLoading /> : null}
      {hasNoAvailableData ? (
        <div className="grid min-h-36 place-items-center py-6 text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível verificar suas pendências</p>
            <Button className="mt-3" onClick={retry} size="sm" type="button" variant="outline">
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {!isPending && !hasNoAvailableData ? (
        attentionCount > 0 ? (
          <ul className="divide-y">
            {openBillsCount > 0 && billsQuery.data ? (
              <DashboardWidgetRow>
                <Link
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  search={{ paymentMethod: "boleto", period, settlement: "unpaid" }}
                  to="/transactions"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning/10 text-warning">
                    <Barcode aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {openBillsCount}{" "}
                      {openBillsCount === 1 ? "boleto em aberto" : "boletos em aberto"}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      {billsQuery.data.overdueCount > 0
                        ? `${billsQuery.data.overdueCount} ${billsQuery.data.overdueCount === 1 ? "vencido" : "vencidos"}`
                        : "Com vencimento no período"}
                    </span>
                  </span>
                  <MoneyValue
                    amount={billsQuery.data.totalOpen}
                    className="shrink-0 font-medium text-sm"
                  />
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </DashboardWidgetRow>
            ) : null}
            {pendingInboxCount > 0 ? (
              <DashboardWidgetRow>
                <Link
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  search={{ app: undefined, date: undefined, page: undefined, status: undefined }}
                  to="/inbox"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info/10 text-info">
                    <Inbox aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm">
                      {pendingInboxCount}{" "}
                      {pendingInboxCount === 1 ? "captura para revisar" : "capturas para revisar"}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      Caixa de entrada
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </DashboardWidgetRow>
            ) : null}
          </ul>
        ) : hasPartialError ? (
          <div className="grid min-h-32 place-items-center py-6 text-center">
            <div>
              <RefreshCw aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-3 font-medium text-sm">Não foi possível verificar tudo</p>
              <Button className="mt-2" onClick={retry} size="xs" type="button" variant="ghost">
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-32 place-items-center py-6 text-center">
            <div>
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-success/10 text-success">
                <CheckCircle2 aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-3 font-medium text-sm">Tudo em dia</p>
              <p className="mt-1 text-muted-foreground text-xs">Nenhuma pendência para revisar.</p>
            </div>
          </div>
        )
      ) : null}
      {hasPartialError && attentionCount > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t py-2 text-muted-foreground text-xs">
          <span>Parte das pendências não foi carregada.</span>
          <Button className="h-7" onClick={retry} size="xs" type="button" variant="ghost">
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </DashboardWidget>
  );
}

function AttentionLoading() {
  return (
    <div aria-label="Carregando pendências" className="grid gap-2 py-2" role="status">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

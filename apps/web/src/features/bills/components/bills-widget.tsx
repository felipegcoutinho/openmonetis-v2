import type { DashboardBill } from "@openmonetis/validators/bills";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Barcode, RefreshCw } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import { billDueLabel } from "../bills.presentation";
import { billsQueryOptions } from "../bills.queries";
import { BillPaymentDialog } from "./bill-payment-dialog";

const maximumVisibleBills = 5;

export function BillsWidget({ period }: { period: string }) {
  const query = useQuery(billsQueryOptions(period));
  const [listOpen, setListOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<DashboardBill | null>(null);
  const bills = query.data?.items ?? [];
  const hiddenCount = Math.max(0, bills.length - maximumVisibleBills);

  const rows = (items: DashboardBill[]) => (
    <ul className="divide-y">
      {items.map((bill) => (
        <BillRow bill={bill} key={bill.id} onSettle={() => setSelectedBill(bill)} />
      ))}
    </ul>
  );

  return (
    <>
      <DashboardWidget
        description="Vencimentos e pagamentos do mês"
        footer={
          bills.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              {hiddenCount > 0 ? (
                <DashboardWidgetListSheet
                  description="Acompanhe vencimentos, responsáveis e status no mês selecionado."
                  onOpenChange={setListOpen}
                  open={listOpen}
                  title="Todos os boletos"
                  triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "boleto" : "boletos"}`}
                >
                  {rows(bills)}
                </DashboardWidgetListSheet>
              ) : null}
              <Link
                className={dashboardWidgetFooterNavigationLinkClassName}
                search={{ paymentMethod: "boleto", period }}
                to="/transactions"
              >
                Ver lançamentos <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : undefined
        }
        icon={<Barcode aria-hidden="true" />}
        title="Boletos"
      >
        {query.isLoading ? <BillsLoading /> : null}
        {query.isError ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="font-medium text-sm">Não foi possível carregar os boletos</p>
              <Button
                className="mt-3"
                onClick={() => void query.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : null}
        {query.data && !query.isError ? (
          <div className="flex flex-1 flex-col">
            {bills.length === 0 ? (
              <DashboardWidgetEmptyState
                description="Os vencimentos do mês aparecerão aqui."
                icon={<Barcode aria-hidden="true" />}
                title="Nenhum boleto neste mês"
              />
            ) : (
              rows(bills.slice(0, maximumVisibleBills))
            )}
          </div>
        ) : null}
      </DashboardWidget>
      <BillPaymentDialog
        accounts={query.data?.accounts ?? []}
        bill={selectedBill}
        key={selectedBill?.id ?? "closed"}
        onOpenChange={(open) => {
          if (!open) setSelectedBill(null);
        }}
        open={Boolean(selectedBill)}
      />
    </>
  );
}

function BillRow({ bill, onSettle }: { bill: DashboardBill; onSettle: () => void }) {
  return (
    <DashboardWidgetRow>
      <EstablishmentLogo className="size-9" name={bill.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-sm">{bill.name}</span>
          {bill.people.length > 1 ? (
            <ul
              aria-label={`Pessoas: ${bill.people.map((person) => person.personName).join(", ")}`}
              className="flex shrink-0 -space-x-1"
            >
              {bill.people.slice(0, 3).map((person) => (
                <li key={person.personId} title={person.personName}>
                  <Avatar className="data-[size=sm]:size-5.5" showBorder={false} size="sm">
                    <AvatarImage alt="" src={person.personAvatarUrl ?? undefined} />
                    <AvatarFallback>
                      {person.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
                    </AvatarFallback>
                  </Avatar>
                </li>
              ))}
              {bill.people.length > 3 ? (
                <li className="grid size-5.5 place-items-center rounded-full bg-muted font-medium text-[9px] text-muted-foreground">
                  +{bill.people.length - 3}
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <p
          className={cn(
            "text-muted-foreground text-xs",
            bill.status === "overdue" && "font-medium text-destructive",
            bill.status === "paid" && "text-success",
          )}
        >
          {bill.status === "paid" ? "Pago" : billDueLabel(bill.dueDate)}
          {bill.currentInstallment && bill.installmentCount
            ? ` · ${bill.currentInstallment}/${bill.installmentCount}`
            : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <MoneyValue amount={bill.amount} className="font-medium text-sm" />
        {bill.isSettled ? (
          <span className="text-success text-xs">Pago</span>
        ) : (
          <Button className="h-auto px-0" onClick={onSettle} size="xs" type="button" variant="link">
            Pagar
          </Button>
        )}
      </div>
    </DashboardWidgetRow>
  );
}

function BillsLoading() {
  return (
    <div aria-label="Carregando boletos" className="grid gap-3" role="status">
      <Skeleton className="h-8 w-36" />
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}

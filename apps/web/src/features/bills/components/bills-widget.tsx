import type { DashboardBill } from "@openmonetis/validators/bills";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ReceiptText, RefreshCw } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { DueDateIndicator } from "@/features/due-date-rules/components/due-date-indicator";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import {
  paymentMethodIcons,
  paymentMethodLabels,
} from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import { billDueLabel, billPaidLabel } from "../bills.presentation";
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
        <BillRow
          bill={bill}
          key={bill.id}
          onSettle={() => {
            setListOpen(false);
            setSelectedBill(bill);
          }}
        />
      ))}
    </ul>
  );

  return (
    <>
      <DashboardWidget
        description="Valores, vencimentos e pagamentos do mês"
        footer={
          bills.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              {hiddenCount > 0 ? (
                <DashboardWidgetListSheet
                  description="Acompanhe vencimentos, responsáveis e status no mês selecionado."
                  onOpenChange={setListOpen}
                  open={listOpen}
                  title="Todas as contas a pagar"
                  triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "conta" : "contas"}`}
                >
                  {rows(bills)}
                </DashboardWidgetListSheet>
              ) : null}
              <Link
                className={dashboardWidgetFooterNavigationLinkClassName}
                search={{ payables: true, period, sort: "dueDate" }}
                to="/transactions"
              >
                Ver lançamentos <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : undefined
        }
        icon={<ReceiptText aria-hidden="true" />}
        title="Contas a pagar"
      >
        {query.isLoading ? <BillsLoading /> : null}
        {query.isError ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="font-medium text-sm">Não foi possível carregar as contas a pagar</p>
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
                description="Informe um vencimento nas despesas por Pix, débito, boleto ou outros meios."
                icon={<ReceiptText aria-hidden="true" />}
                title="Nenhuma conta com vencimento neste mês"
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
  const PaymentIcon = paymentMethodIcons[bill.paymentMethod];
  return (
    <DashboardWidgetRow>
      <Link
        className="shrink-0"
        to="/transactions"
        search={{
          period: bill.period,
          payables: true,
          paymentMethod: bill.paymentMethod,
          q: bill.name,
        }}
      >
        <EstablishmentLogo
          categoryIcon={bill.categoryIcon}
          editable={false}
          className="size-9"
          name={bill.name}
          size={36}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <BillName bill={bill} />
        </div>
        <p
          className={cn(
            "text-muted-foreground text-xs",
            bill.status === "overdue" && "font-medium text-destructive",
            bill.status === "paid" && "text-success",
          )}
        >
          <span className="inline-flex items-center gap-1">
            <PaymentIcon aria-hidden="true" className="size-3" />
            {paymentMethodLabels[bill.paymentMethod]}
          </span>
          {" · "}
          {bill.status === "paid" ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 aria-hidden="true" className="size-3 animate-status-confirm" />
              {bill.settledDate ? billPaidLabel(bill.settledDate) : "Pago"}
            </span>
          ) : (
            <DueDateIndicator
              dueDate={bill.dueDate}
              originalDueDate={bill.originalDueDate}
              adjustment={bill.dueDateAdjustment}
              excluded={bill.dueDateRuleExcluded}
              editable={bill.dueDateExceptionEditable}
              target={
                bill.recordId
                  ? { target: "transaction", transactionId: bill.recordId }
                  : bill.recurringRuleId
                    ? {
                        target: "recurring",
                        recurringRuleId: bill.recurringRuleId,
                        occurrenceDate: bill.purchaseDate,
                      }
                    : undefined
              }
            >
              {billDueLabel(bill.dueDate)}
            </DueDateIndicator>
          )}
          {bill.currentInstallment && bill.installmentCount
            ? ` · ${bill.currentInstallment}/${bill.installmentCount}`
            : null}
        </p>
        {bill.isSettled && (bill.dueDateAdjustment || bill.dueDateRuleExcluded) ? (
          <div className="text-xs">
            <DueDateIndicator
              dueDate={bill.dueDate}
              originalDueDate={bill.originalDueDate}
              adjustment={bill.dueDateAdjustment}
              excluded={bill.dueDateRuleExcluded}
              editable={bill.dueDateExceptionEditable}
              target={
                bill.recordId
                  ? { target: "transaction", transactionId: bill.recordId }
                  : bill.recurringRuleId
                    ? {
                        target: "recurring",
                        recurringRuleId: bill.recurringRuleId,
                        occurrenceDate: bill.purchaseDate,
                      }
                    : undefined
              }
            >
              {billDueLabel(bill.dueDate)}
            </DueDateIndicator>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <MoneyValue
          amount={bill.amount}
          className={cn("font-medium text-sm", bill.isSettled && "text-success")}
        />
        {bill.isSettled ? (
          <span className="animate-status-confirm text-success text-xs">Pago</span>
        ) : (
          <Button
            className="h-auto px-0 text-xs"
            onClick={onSettle}
            size="xs"
            type="button"
            variant="link"
          >
            Registrar pagamento
          </Button>
        )}
      </div>
    </DashboardWidgetRow>
  );
}

function BillName({ bill }: { bill: DashboardBill }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Link
            to="/transactions"
            search={{
              period: bill.period,
              payables: true,
              paymentMethod: bill.paymentMethod,
              q: bill.name,
            }}
            className="group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
          />
        }
      >
        <span className="truncate">{bill.name}</span>
        <DashboardItemLinkArrow />
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <p className="font-medium">Valores por pessoa</p>
        <div className="mt-3 grid gap-3">
          {bill.people.map((person) => (
            <div key={person.personId} className="flex items-center gap-3">
              <Avatar>
                <AvatarImage alt="" src={person.personAvatarUrl ?? undefined} />
                <AvatarFallback>
                  {person.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium text-sm">
                {person.personName}
              </span>
              <MoneyValue amount={person.amount} className="shrink-0 font-medium text-sm" />
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function BillsLoading() {
  return (
    <div aria-label="Carregando contas a pagar" className="grid gap-3" role="status">
      <Skeleton className="h-8 w-36" />
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}

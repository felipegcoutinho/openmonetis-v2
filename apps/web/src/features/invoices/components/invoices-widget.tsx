import type { DashboardInvoice } from "@openmonetis/validators/invoices";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cardInvoiceStatusLabels } from "@/features/cards/cards.presentation";
import { DashboardItemLinkArrow } from "@/features/dashboard/components/dashboard-item-link-arrow";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { cn } from "@/lib/utils";
import { invoiceDueLabel, invoicePaidLabel } from "../invoices.presentation";
import { invoicesQueryOptions } from "../invoices.queries";
import { InvoicePaymentDialog } from "./invoice-payment-dialog";

const maximumVisibleInvoices = 5;

export function InvoicesWidget({ period }: { period: string }) {
  const query = useQuery(invoicesQueryOptions(period));
  const [selected, setSelected] = useState<DashboardInvoice | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const invoices = query.data?.items ?? [];
  const hiddenCount = Math.max(0, invoices.length - maximumVisibleInvoices);
  const selectInvoiceToPay = (invoice: DashboardInvoice) => {
    setListOpen(false);
    setSelected(invoice);
  };
  return (
    <>
      <DashboardWidget
        title="Faturas"
        description="Valores, vencimentos e pagamentos acumulados"
        icon={<ReceiptText />}
        footer={
          invoices.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              {hiddenCount > 0 ? (
                <DashboardWidgetListSheet
                  description="Consulte valores, vencimentos e responsáveis no mês selecionado."
                  onOpenChange={setListOpen}
                  open={listOpen}
                  title="Todas as faturas"
                  triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "fatura" : "faturas"}`}
                >
                  <ul className="divide-y">
                    {invoices.map((invoice) => (
                      <InvoiceRow
                        key={invoice.cardId}
                        invoice={invoice}
                        onPay={() => selectInvoiceToPay(invoice)}
                      />
                    ))}
                  </ul>
                </DashboardWidgetListSheet>
              ) : null}
              <Link className={dashboardWidgetFooterNavigationLinkClassName} to="/cards">
                Ver cartões <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : undefined
        }
      >
        {query.isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        ) : null}
        {query.isError ? (
          <p className="text-destructive text-sm">Não foi possível carregar as faturas.</p>
        ) : null}
        {query.data ? (
          <div className="flex flex-1 flex-col">
            {query.data.items.length === 0 ? (
              <DashboardWidgetEmptyState
                description="As faturas do mês aparecerão aqui."
                icon={<CreditCard aria-hidden="true" />}
                title="Nenhuma fatura neste mês"
              />
            ) : (
              <ul className="divide-y">
                {invoices.slice(0, maximumVisibleInvoices).map((invoice) => (
                  <InvoiceRow
                    key={invoice.cardId}
                    invoice={invoice}
                    onPay={() => selectInvoiceToPay(invoice)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </DashboardWidget>
      <InvoicePaymentDialog
        key={selected?.cardId ?? "closed"}
        invoice={selected}
        accounts={query.data?.accounts ?? []}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}

function InvoiceRow({ invoice, onPay }: { invoice: DashboardInvoice; onPay: () => void }) {
  const isPaid = invoice.status === "paid";
  return (
    <DashboardWidgetRow>
      <Link
        to="/cards/$cardId"
        params={{ cardId: invoice.cardId }}
        search={{ period: invoice.period }}
        className="shrink-0"
      >
        {invoice.logo ? (
          <Image
            alt={`Logo de ${invoice.cardName}`}
            src={invoice.logo}
            width={36}
            height={36}
            layout="fixed"
            className="size-9 rounded-full object-contain"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-muted">
            <CreditCard className="size-4" />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <InvoiceCardName invoice={invoice} />
        </div>
        {invoice.remainingAmount === 0 && invoice.latestPayment ? (
          <p className="flex items-center gap-1 text-success text-xs">
            <CheckCircle2 aria-hidden="true" className="size-3 shrink-0" />
            <span>{invoicePaidLabel(invoice.latestPayment.paidAt)}</span>
          </p>
        ) : (
          <p
            className={cn(
              "text-muted-foreground text-xs",
              invoice.status === "overdue" && "font-medium text-destructive",
            )}
          >
            {invoice.remainingAmount === 0
              ? cardInvoiceStatusLabels[invoice.status]
              : invoiceDueLabel(invoice.dueDate)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <MoneyValue
          amount={isPaid ? invoice.amount : invoice.remainingAmount}
          className={cn("font-medium text-sm", isPaid && "text-success")}
        />
        {invoice.remainingAmount > 0 ? (
          <Button
            className="h-auto px-0 text-xs"
            onClick={onPay}
            size="xs"
            type="button"
            variant="link"
          >
            Pagar
          </Button>
        ) : (
          <span className="text-success text-xs">Paga</span>
        )}
      </div>
    </DashboardWidgetRow>
  );
}

function InvoiceCardName({ invoice }: { invoice: DashboardInvoice }) {
  const linkClassName =
    "group inline-flex min-w-0 items-center gap-1 rounded-sm font-medium text-sm hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  if (invoice.people.length === 0) {
    return (
      <Link
        className={linkClassName}
        params={{ cardId: invoice.cardId }}
        search={{ period: invoice.period }}
        to="/cards/$cardId"
      >
        <span className="truncate">{invoice.cardName}</span>
        <DashboardItemLinkArrow />
      </Link>
    );
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Link
            className={linkClassName}
            params={{ cardId: invoice.cardId }}
            search={{ period: invoice.period }}
            to="/cards/$cardId"
          />
        }
      >
        <span className="truncate">{invoice.cardName}</span>
        <DashboardItemLinkArrow />
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72">
        <p className="font-medium">Valores por pessoa</p>
        <div className="mt-3 grid gap-3">
          {invoice.people.map((person) => (
            <div
              className="flex gap-3 border-b pb-3 last:border-b-0 last:pb-0"
              key={person.personId}
            >
              <Avatar className="overflow-hidden" showBorder={false}>
                <AvatarImage alt="" src={person.personAvatarUrl ?? undefined} />
                <AvatarFallback>
                  {person.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-sm">{person.personName}</span>
                  <MoneyValue amount={person.amount} className="shrink-0 font-medium text-sm" />
                </div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
                  <span>Pago</span>
                  <MoneyValue amount={person.paidAmount} />
                </div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
                  <span>Em aberto</span>
                  <MoneyValue amount={person.remainingAmount} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

import type { CardOutput } from "@openmonetis/validators/cards";
import type { AdjustInvoiceInput, DashboardInvoice } from "@openmonetis/validators/invoices";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CreditCard,
  RotateCcw,
  Scale,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  FinancialSummaryAction,
  FinancialSummaryHeader,
} from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cardQueryOptions } from "@/features/cards/cards.queries";
import { AdjustInvoiceDialog } from "@/features/invoices/components/adjust-invoice-dialog";
import { InvoiceDatesDialog } from "@/features/invoices/components/invoice-dates-dialog";
import {
  useAdjustInvoiceMutation,
  useUndoInvoicePaymentMutation,
} from "@/features/invoices/invoices.mutations";
import { formatInvoicePaymentOption } from "@/features/invoices/invoices.presentation";
import { invoicesQueryOptions } from "@/features/invoices/invoices.queries";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { getCardBrandAsset } from "../card-brand-assets";
import { cardBrandLabels, cardInvoiceStatusLabels, formatInvoiceDate } from "../cards.presentation";

type CardInvoicesPageProps = {
  cardId: string;
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
};

export function CardInvoicesPage({ cardId, search, onSearchChange }: CardInvoicesPageProps) {
  const selectedPeriod = search.period ?? getCurrentPeriod();
  const cardQuery = useQuery(cardQueryOptions(cardId, selectedPeriod));
  const invoicesQuery = useQuery(invoicesQueryOptions(selectedPeriod));
  const invoice = invoicesQuery.data?.items.find((item) => item.cardId === cardId);

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {cardQuery.isLoading ? <CardInvoicesLoading /> : null}
        {cardQuery.isError ? <CardInvoicesNotFound /> : null}
        {cardQuery.data ? (
          <TransactionsContainer
            onSearchChange={onSearchChange}
            scope={getCardInvoiceScope(cardQuery.data, selectedPeriod, invoice)}
            search={search}
          />
        ) : null}
      </main>
    </ProtectedRoute>
  );
}

function getCardInvoiceScope(card: CardOutput, period: string, invoice?: DashboardInvoice) {
  const periodLabel = formatPeriod(period);

  return {
    allowCreate: card.status === "active",
    cardIds: [card.id],
    createDefaults: {
      cardId: card.id,
      invoicePeriod: period,
      paymentMethod: "credit_card" as const,
    },
    createTypes: ["income", "expense"] as const,
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Finanças" },
        { label: "Cartões", href: "/cards" },
        { label: card.name },
        { label: `Fatura de ${periodLabel}` },
      ],
      summary: (
        <CardInvoiceSummary
          card={card}
          invoice={invoice}
          period={period}
          periodLabel={periodLabel}
        />
      ),
    },
    hiddenFilters: ["type", "paymentMethod", "accountCard"] as const,
    periodNavigationPlacement: "afterPageHeader" as const,
  };
}

function CardInvoiceSummary({
  card,
  invoice,
  period,
  periodLabel,
}: {
  card: CardOutput;
  invoice?: DashboardInvoice;
  period: string;
  periodLabel: string;
}) {
  const brandAsset = getCardBrandAsset(card.brand);
  const undoMutation = useUndoInvoicePaymentMutation();
  const adjustMutation = useAdjustInvoiceMutation();
  const payments = invoice?.payments ?? [];
  const invoicePeriod = invoice?.period ?? "";
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0];

  async function adjustInvoice(input: AdjustInvoiceInput) {
    await adjustMutation.mutateAsync({ cardId: card.id, period, input });
    setAdjustOpen(false);
    toast.success("Fatura ajustada", {
      description: "A diferença foi registrada nos lançamentos da fatura.",
    });
  }

  return (
    <>
      <FinancialSummaryHeader
        accentImage={card.logo}
        actions={
          <>
            {card.status === "active" ? (
              <FinancialSummaryAction onClick={() => setAdjustOpen(true)}>
                <Scale aria-hidden="true" className="size-4" />
                Ajustar fatura
              </FinancialSummaryAction>
            ) : null}
            <FinancialSummaryAction onClick={() => setDatesOpen(true)}>
              <CalendarClock aria-hidden="true" className="size-4" />
              Ajustar datas
            </FinancialSummaryAction>
            {selectedPayment ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <FinancialSummaryAction disabled={undoMutation.isPending} type="button" />
                  }
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Desfazer pagamento
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desfazer pagamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {payments.length > 1
                        ? "Selecione o pagamento que deseja desfazer. O valor será devolvido à conta e o limite usado do cartão será restaurado."
                        : "O pagamento selecionado será removido. O saldo voltará para a conta e o limite usado do cartão será restaurado."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {payments.length > 1 ? (
                    <Select onValueChange={setSelectedPaymentId} value={selectedPayment.id}>
                      <SelectTrigger aria-label="Pagamento a desfazer" className="w-full">
                        <SelectValue>
                          {formatInvoicePaymentOption(
                            selectedPayment.amount,
                            selectedPayment.paidAt,
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {payments.map((payment) => (
                          <SelectItem key={payment.id} value={payment.id}>
                            {formatInvoicePaymentOption(payment.amount, payment.paidAt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {formatInvoicePaymentOption(selectedPayment.amount, selectedPayment.paidAt)}
                    </p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await undoMutation.mutateAsync({
                            cardId: card.id,
                            period: invoicePeriod,
                            paymentId: selectedPayment.id,
                          });
                          toast.success("Pagamento desfeito");
                        } catch {
                          toast.error("Não foi possível desfazer o pagamento");
                        }
                      }}
                    >
                      Desfazer pagamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </>
        }
        eyebrow={`Fatura de ${periodLabel}`}
        identity={<CardInvoiceIcon card={card} size="lg" />}
        metrics={[
          {
            icon: <CircleCheck aria-hidden="true" className="size-3.5" />,
            label: "Status",
            value: cardInvoiceStatusLabels[card.invoiceSummary.status],
          },
          {
            icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
            label: "Fecha",
            value: formatInvoiceDate(card.invoiceSummary.closingDate),
          },
          {
            icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
            label: "Vence",
            value: formatInvoiceDate(card.invoiceSummary.dueDate),
          },
        ]}
        primaryLabel="Valor da fatura"
        primaryValue={<MoneyValue amount={card.invoiceSummary.amount} />}
        subtitle={
          <>
            {brandAsset ? (
              <Image
                alt={cardBrandLabels[card.brand]}
                className="h-4 w-auto object-contain"
                height={16}
                layout="fixed"
                src={brandAsset}
                width={32}
              />
            ) : null}
            <span>{cardBrandLabels[card.brand]}</span>
          </>
        }
        title={card.name}
      />
      {datesOpen ? (
        <InvoiceDatesDialog
          key={`${card.id}-${period}-${card.invoiceSummary.closingDate}-${card.invoiceSummary.dueDate}`}
          cardId={card.id}
          cardName={card.name}
          closingDate={card.invoiceSummary.closingDate}
          dueDate={card.invoiceSummary.dueDate}
          onOpenChange={setDatesOpen}
          open={datesOpen}
          period={period}
        />
      ) : null}
      {adjustOpen ? (
        <AdjustInvoiceDialog
          cardName={card.name}
          currentAmount={card.invoiceSummary.amount}
          onOpenChange={setAdjustOpen}
          onSubmit={adjustInvoice}
          open={adjustOpen}
          period={period}
        />
      ) : null}
    </>
  );
}

function CardInvoiceIcon({ card, size = "sm" }: { card: CardOutput; size?: "sm" | "lg" }) {
  const dimension = size === "lg" ? 64 : 24;

  if (!card.logo)
    return (
      <span
        className={
          size === "lg"
            ? "grid size-12 shrink-0 place-items-center rounded-xl bg-current/10"
            : "grid size-6 shrink-0 place-items-center rounded-md bg-brand/10"
        }
      >
        <CreditCard aria-hidden="true" className={size === "lg" ? "size-6" : "size-5"} />
      </span>
    );

  return (
    <Image
      alt=""
      className={
        size === "lg"
          ? "size-16 shrink-0 rounded-full object-cover"
          : "size-6 shrink-0 rounded-md object-contain"
      }
      height={dimension}
      layout="fixed"
      src={card.logo}
      width={dimension}
    />
  );
}

function CardInvoicesLoading() {
  return (
    <section className="app-page project-container">
      <p className="text-muted-foreground text-sm">Carregando fatura...</p>
    </section>
  );
}

function CardInvoicesNotFound() {
  return (
    <section className="app-page project-container">
      <p className="text-destructive text-sm" role="alert">
        Cartão não encontrado.
      </p>
    </section>
  );
}

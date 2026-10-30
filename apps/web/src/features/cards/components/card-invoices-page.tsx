import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { CardOutput, ReplaceCardInput } from "@openmonetis/validators/cards";
import type { AdjustInvoiceInput } from "@openmonetis/validators/invoices";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Pencil,
  RotateCcw,
  Scale,
  Undo2,
  Wallet,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EntityLoadError } from "@/components/entity-load-error";
import { FinancialDetailLoading } from "@/components/financial-detail-loading";
import {
  FinancialSummaryAction,
  FinancialSummaryBadge,
  FinancialSummaryHeader,
  FinancialSummaryMenu,
  FinancialSummaryTitleAction,
} from "@/components/financial-summary-header";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
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
} from "@/components/ui/alert-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardQueryOptions } from "@/features/cards/cards.queries";
import { DueDateIndicator } from "@/features/due-date-rules/components/due-date-indicator";
import { AdjustInvoiceDialog } from "@/features/invoices/components/adjust-invoice-dialog";
import { InvoiceDatesDialog } from "@/features/invoices/components/invoice-dates-dialog";
import { InvoicePaymentDialog } from "@/features/invoices/components/invoice-payment-dialog";
import {
  useAdjustInvoiceMutation,
  useReopenInvoiceMutation,
  useUndoInvoicePaymentMutation,
} from "@/features/invoices/invoices.mutations";
import { formatInvoicePaymentOption } from "@/features/invoices/invoices.presentation";
import { invoicesQueryOptions } from "@/features/invoices/invoices.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import { getCardBrandAsset } from "../card-brand-assets";
import { useReplaceCardMutation } from "../cards.mutations";
import { cardBrandLabels, cardInvoiceStatusLabels, formatInvoiceDate } from "../cards.presentation";
import { CardDialog } from "./card-dialog";
import { CardSpendingFlow } from "./card-spending-flow";

type CardInvoicesPageProps = {
  cardId: string;
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
};

// Opening the payment fetches the invoices; the dialog's query then reuses that fresh result.
const PAYMENT_INVOICES_STALE_TIME = 30_000;

export function CardInvoicesPage({ cardId, search, onSearchChange }: CardInvoicesPageProps) {
  const selectedPeriod = search.period ?? getCurrentPeriodInBrazil();
  const queryClient = useQueryClient();
  const cardQuery = useQuery(cardQueryOptions(cardId, selectedPeriod));
  const peopleQuery = useQuery(peopleQueryOptions());
  const accountsQuery = useQuery(accountsQueryOptions());
  const replaceMutation = useReplaceCardMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [openingPayment, setOpeningPayment] = useState(false);
  // The payment dialog needs the per-person invoice breakdown, so it is loaded only on demand.
  const invoicesQuery = useQuery({
    ...invoicesQueryOptions(selectedPeriod),
    enabled: paymentOpen,
    staleTime: PAYMENT_INVOICES_STALE_TIME,
  });
  const invoice = invoicesQuery.data?.items.find((item) => item.cardId === cardId);
  const activePeople = peopleQuery.data?.filter((person) => person.status === "active");
  const periodLabel = formatPeriod(selectedPeriod);
  useDocumentTitle(
    cardQuery.data ? `${cardQuery.data.name} · Fatura de ${periodLabel}` : undefined,
  );

  async function saveCard(input: ReplaceCardInput) {
    await replaceMutation.mutateAsync({ id: cardId, input });
    setEditOpen(false);
    toast.success("Cartão atualizado");
  }

  async function openPayment() {
    setOpeningPayment(true);
    try {
      const invoices = await queryClient.fetchQuery({
        ...invoicesQueryOptions(selectedPeriod),
        staleTime: PAYMENT_INVOICES_STALE_TIME,
      });
      if (!invoices.items.some((item) => item.cardId === cardId)) throw new Error();
      setPaymentOpen(true);
    } catch {
      toast.error("Não foi possível abrir o pagamento", {
        description: "Tente novamente em instantes.",
      });
    } finally {
      setOpeningPayment(false);
    }
  }

  function changePeriod(period: string) {
    onSearchChange({ period, dateStart: undefined, dateEnd: undefined, page: undefined });
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {cardQuery.isLoading ? <FinancialDetailLoading message="Carregando fatura" /> : null}
        {cardQuery.isError && !cardQuery.data ? (
          <EntityLoadError
            error={cardQuery.error}
            entity="o cartão"
            onRetry={() => void cardQuery.refetch()}
          >
            <CardInvoicesNotFound />
          </EntityLoadError>
        ) : null}
        {cardQuery.data ? (
          <TransactionsContainer
            onSearchChange={onSearchChange}
            scope={{
              allowCreate: cardQuery.data.status === "active",
              cardIds: [cardQuery.data.id],
              createDefaults: {
                cardId: cardQuery.data.id,
                invoicePeriod: selectedPeriod,
                paymentMethod: "credit_card" as const,
              },
              createTypes: ["income", "expense"] as const,
              header: {
                breadcrumbs: [
                  { label: "Visão geral", href: "/dashboard" },
                  { label: "Finanças" },
                  { label: "Cartões", href: "/cards" },
                  { label: cardQuery.data.name },
                  { label: `Fatura de ${periodLabel}` },
                ],
                summary: (
                  <CardInvoiceSummary
                    card={cardQuery.data}
                    isRefreshing={cardQuery.isPlaceholderData}
                    onEdit={() => setEditOpen(true)}
                    onPay={() => void openPayment()}
                    payPending={openingPayment}
                    people={activePeople}
                    period={selectedPeriod}
                    periodLabel={periodLabel}
                  />
                ),
              },
              hiddenFilters: ["type", "paymentMethod", "accountCard"] as const,
              contentNavigation: (
                <CardSpendingFlow
                  cardId={cardQuery.data.id}
                  cycle={cardQuery.data.cycleSpending}
                  onPeriodChange={changePeriod}
                  period={selectedPeriod}
                />
              ),
              periodNavigationPlacement: "afterPageHeader" as const,
            }}
            search={search}
          />
        ) : null}
        {cardQuery.data ? (
          <CardDialog
            accounts={(accountsQuery.data ?? []).filter(
              (account) => !account.isArchived || account.id === cardQuery.data.accountId,
            )}
            card={cardQuery.data}
            onOpenChange={setEditOpen}
            onSubmit={saveCard}
            open={editOpen}
          />
        ) : null}
        <InvoicePaymentDialog
          key={paymentOpen ? (invoice?.cardId ?? "closed") : "closed"}
          invoice={paymentOpen ? (invoice ?? null) : null}
          accounts={invoicesQuery.data?.accounts ?? []}
          open={paymentOpen && Boolean(invoice)}
          onOpenChange={setPaymentOpen}
        />
      </main>
    </ProtectedRoute>
  );
}

function CardInvoiceSummary({
  card,
  isRefreshing,
  onEdit,
  onPay,
  payPending,
  people,
  period,
  periodLabel,
}: {
  card: CardOutput;
  isRefreshing: boolean;
  onEdit: () => void;
  onPay: () => void;
  payPending: boolean;
  /** Active people; `undefined` while they load. */
  people: PersonOutput[] | undefined;
  period: string;
  periodLabel: string;
}) {
  const summary = card.invoiceSummary;
  const payments = summary.payments;
  const isActive = card.status === "active";
  const brandAsset = getCardBrandAsset(card.brand);
  const adjustMutation = useAdjustInvoiceMutation();
  const [datesOpen, setDatesOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const canPay = isActive && summary.remainingAmount > 0;
  const canAdjustInvoice = isActive && period <= getCurrentPeriodInBrazil();
  const adjustBlockedReason =
    payments.length > 0
      ? "Reabra a fatura para ajustá-la."
      : people?.length === 0
        ? "Cadastre uma pessoa ativa primeiro."
        : undefined;
  const datesBlockedReason =
    payments.length > 0 || summary.status === "paid"
      ? "Indisponível em fatura com pagamento."
      : undefined;
  const hasMenuActions = isActive || payments.length > 0;

  async function adjustInvoice(input: AdjustInvoiceInput) {
    const adjustment = await adjustMutation.mutateAsync({ cardId: card.id, period, input });
    setAdjustOpen(false);
    if (adjustment.id === null) {
      toast.info("A fatura já estava com esse valor");
      return;
    }
    toast.success("Fatura ajustada", {
      description: "A diferença foi registrada nos lançamentos da fatura.",
    });
  }

  return (
    <div
      aria-busy={isRefreshing}
      className={cn("transition-opacity", isRefreshing && "opacity-70")}
    >
      <FinancialSummaryHeader
        accentImage={card.logo}
        actions={
          canPay || hasMenuActions ? (
            <>
              {canPay ? (
                <FinancialSummaryAction
                  primary
                  disabled={payPending || isRefreshing}
                  onClick={onPay}
                  type="button"
                >
                  <Wallet aria-hidden="true" className="size-4" />
                  {payPending ? "Abrindo…" : "Registrar pagamento"}
                </FinancialSummaryAction>
              ) : null}
              {hasMenuActions ? (
                <FinancialSummaryMenu disabled={isRefreshing}>
                  {canAdjustInvoice ? (
                    <SummaryMenuItem
                      description={adjustBlockedReason}
                      disabled={people === undefined || adjustBlockedReason !== undefined}
                      icon={<Scale aria-hidden="true" />}
                      label="Ajustar fatura"
                      onClick={() => setAdjustOpen(true)}
                    />
                  ) : null}
                  {isActive ? (
                    <SummaryMenuItem
                      description={datesBlockedReason}
                      disabled={datesBlockedReason !== undefined}
                      icon={<CalendarClock aria-hidden="true" />}
                      label="Ajustar datas"
                      onClick={() => setDatesOpen(true)}
                    />
                  ) : null}
                  {payments.length > 0 ? (
                    <>
                      {isActive ? <DropdownMenuSeparator /> : null}
                      <SummaryMenuItem
                        icon={<Undo2 aria-hidden="true" />}
                        label={payments.length > 1 ? "Desfazer um pagamento" : "Desfazer pagamento"}
                        onClick={() => setUndoOpen(true)}
                      />
                      <SummaryMenuItem
                        description="Desfaz todos os pagamentos."
                        icon={<RotateCcw aria-hidden="true" />}
                        label="Reabrir fatura"
                        onClick={() => setReopenOpen(true)}
                        variant="destructive"
                      />
                    </>
                  ) : null}
                </FinancialSummaryMenu>
              ) : null}
            </>
          ) : undefined
        }
        details={summary.totalLimit > 0 ? <CardLimitUsage summary={summary} /> : undefined}
        eyebrow={`Fatura de ${periodLabel}`}
        identity={<CardInvoiceIcon card={card} />}
        metrics={[
          {
            icon:
              summary.status === "overdue" ? (
                <CircleAlert aria-hidden="true" className="size-3.5" />
              ) : (
                <CircleCheck aria-hidden="true" className="size-3.5" />
              ),
            label: "Status",
            value: (
              <span
                className={cn(
                  (summary.status === "overdue" || summary.status === "paid") && "font-medium",
                )}
              >
                {cardInvoiceStatusLabels[summary.status]}
              </span>
            ),
          },
          {
            icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
            label: "Fecha",
            value: formatInvoiceDate(summary.closingDate),
          },
          {
            icon: <CalendarDays aria-hidden="true" className="size-3.5" />,
            label: "Vence",
            value: (
              <DueDateIndicator
                dueDate={summary.dueDate}
                originalDueDate={summary.originalDueDate}
                adjustment={summary.dueDateAdjustment}
                excluded={summary.dueDateRuleExcluded}
                editable={summary.dueDateExceptionEditable}
                target={{ target: "invoice", cardId: card.id, period }}
              >
                {formatInvoiceDate(summary.dueDate)}
              </DueDateIndicator>
            ),
          },
        ]}
        primaryDescription={
          summary.paidAmount > 0 ? (
            <>
              <span>
                Pago <MoneyValue amount={summary.paidAmount} className="text-current" />
              </span>
              {summary.remainingAmount > 0 ? (
                <span>
                  Restante <MoneyValue amount={summary.remainingAmount} className="text-current" />
                </span>
              ) : null}
            </>
          ) : undefined
        }
        primaryLabel="Valor da fatura"
        primaryValue={<MoneyValue amount={summary.amount} />}
        subtitle={
          <>
            {brandAsset ? (
              <Image
                alt=""
                className="h-4 w-auto object-contain"
                height={16}
                layout="fixed"
                src={brandAsset}
                width={32}
              />
            ) : null}
            <span>{cardBrandLabels[card.brand]}</span>
            {isActive ? null : <FinancialSummaryBadge>Inativo</FinancialSummaryBadge>}
          </>
        }
        title={card.name}
        titleAction={
          <FinancialSummaryTitleAction
            aria-label={`Editar cartão ${card.name}`}
            onClick={onEdit}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </FinancialSummaryTitleAction>
        }
      />
      {datesOpen ? (
        <InvoiceDatesDialog
          key={`${card.id}-${period}-${summary.closingDate}-${summary.dueDate}`}
          cardId={card.id}
          cardName={card.name}
          closingDate={summary.closingDate}
          dueDate={summary.dueDate}
          onOpenChange={setDatesOpen}
          open={datesOpen}
          period={period}
        />
      ) : null}
      {adjustOpen && people ? (
        <AdjustInvoiceDialog
          cardName={card.name}
          currentAmount={summary.amount}
          onOpenChange={setAdjustOpen}
          onSubmit={adjustInvoice}
          open={adjustOpen}
          people={people}
          period={period}
        />
      ) : null}
      <UndoInvoicePaymentDialog
        cardId={card.id}
        onOpenChange={setUndoOpen}
        open={undoOpen}
        payments={payments}
        period={period}
      />
      <ReopenInvoiceDialog
        cardId={card.id}
        onOpenChange={setReopenOpen}
        open={reopenOpen}
        paymentCount={payments.length}
        period={period}
      />
    </div>
  );
}

function SummaryMenuItem({
  description,
  disabled,
  icon,
  label,
  onClick,
  variant,
}: {
  description?: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuItem
      className="items-start"
      disabled={disabled}
      onClick={onClick}
      variant={variant}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="grid gap-0.5">
        <span>{label}</span>
        {description ? <span className="text-muted-foreground text-xs">{description}</span> : null}
      </span>
    </DropdownMenuItem>
  );
}

function CardLimitUsage({ summary }: { summary: CardOutput["invoiceSummary"] }) {
  const usage = summary.usagePercentage.toLocaleString("pt-BR");

  return (
    <div className="grid gap-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-current/70">Limite disponível</span>
        <span className="flex flex-wrap items-baseline gap-1">
          <MoneyValue amount={summary.availableLimit} className="font-medium" />
          <span className="text-current/70">
            de <MoneyValue amount={summary.totalLimit} />
          </span>
        </span>
      </div>
      <Progress
        aria-label={`${usage}% do limite utilizado`}
        indicatorClassName={cn("bg-current", summary.usagePercentage > 100 && "bg-destructive")}
        trackClassName="bg-current/20"
        value={Math.min(100, summary.usagePercentage)}
      />
      <p className="text-current/70 text-xs">
        {usage}% utilizado · parcelas futuras também ocupam o limite.
      </p>
    </div>
  );
}

function UndoInvoicePaymentDialog({
  cardId,
  onOpenChange,
  open,
  payments,
  period,
}: {
  cardId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  payments: CardOutput["invoiceSummary"]["payments"];
  period: string;
}) {
  const mutation = useUndoInvoicePaymentMutation();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const selectedPayment =
    payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0];

  async function undoPayment() {
    if (!selectedPayment) return;
    try {
      await mutation.mutateAsync({ cardId, period, paymentId: selectedPayment.id });
      onOpenChange(false);
      setSelectedPaymentId(null);
      toast.success("Pagamento desfeito");
    } catch {
      toast.error("Não foi possível desfazer o pagamento");
    }
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {payments.length > 1 ? "Desfazer um pagamento?" : "Desfazer pagamento?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {payments.length > 1
              ? "Selecione o pagamento que deseja desfazer. O valor volta para a conta e o limite usado do cartão é restaurado."
              : "O pagamento será removido. O valor volta para a conta e o limite usado do cartão é restaurado."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {selectedPayment && payments.length > 1 ? (
          <Select onValueChange={setSelectedPaymentId} value={selectedPayment.id}>
            <SelectTrigger aria-label="Pagamento a desfazer" className="w-full">
              <SelectValue>
                {formatInvoicePaymentOption(selectedPayment.amount, selectedPayment.paidAt)}
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
        ) : null}
        {selectedPayment && payments.length === 1 ? (
          <p className="text-muted-foreground text-sm">
            {formatInvoicePaymentOption(selectedPayment.amount, selectedPayment.paidAt)}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!selectedPayment || mutation.isPending}
            onClick={() => void undoPayment()}
          >
            {mutation.isPending ? "Desfazendo…" : "Desfazer pagamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReopenInvoiceDialog({
  cardId,
  onOpenChange,
  open,
  paymentCount,
  period,
}: {
  cardId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  paymentCount: number;
  period: string;
}) {
  const mutation = useReopenInvoiceMutation();

  async function reopenInvoice() {
    try {
      await mutation.mutateAsync({ cardId, period });
      onOpenChange(false);
      toast.success("Fatura reaberta", { description: "Todos os pagamentos foram desfeitos." });
    } catch {
      toast.error("Não foi possível reabrir a fatura");
    }
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir fatura?</AlertDialogTitle>
          <AlertDialogDescription>
            {paymentCount === 1
              ? "O pagamento registrado será desfeito."
              : "Todos os pagamentos registrados serão desfeitos."}{" "}
            Os lançamentos correspondentes nas contas serão removidos e os saldos recalculados.
            Depois, você poderá ajustar a fatura e registrar novos pagamentos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid-cols-1 sm:grid-cols-2">
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() => void reopenInvoice()}
            variant="destructive"
          >
            {mutation.isPending ? "Reabrindo…" : "Reabrir fatura"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CardInvoiceIcon({ card }: { card: CardOutput }) {
  if (!card.logo) {
    return (
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-current/10">
        <CreditCard aria-hidden="true" className="size-7" />
      </span>
    );
  }

  return (
    <Image
      alt=""
      className="size-16 shrink-0 rounded-full object-cover"
      height={64}
      layout="fixed"
      src={card.logo}
      width={64}
    />
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

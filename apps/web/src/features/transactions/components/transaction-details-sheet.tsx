import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  CalendarDays,
  Circle,
  CircleCheck,
  Clock3,
  CreditCard,
  FileText,
  Landmark,
  Layers3,
  Paperclip,
  Pencil,
  ReceiptText,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionAttachments } from "@/features/attachments/components/transaction-attachments";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDateTime,
  formatPaymentMethod,
  formatPeriod,
  recurrenceFrequencyLabels,
  transactionConditionLabels,
  transactionOriginLabels,
} from "../transactions.presentation";
import { transactionDetailQueryOptions } from "../transactions.queries";
import { TransactionTypeBadge } from "./transaction-type-badge";

type TransactionDetailsSheetProps = {
  onEdit: (transaction: TransactionOutput) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  transaction: TransactionOutput | null;
};

export function TransactionDetailsSheet({
  onEdit,
  onOpenChange,
  open,
  transaction,
}: TransactionDetailsSheetProps) {
  const recordId = transaction?.recordId ?? "";
  const detailQuery = useQuery({
    ...transactionDetailQueryOptions(recordId),
    enabled: open && Boolean(recordId),
  });
  const detail = detailQuery.data ?? transaction;
  const canEdit = detail?.origin === "regular" && detail.paymentMethod !== null;

  function edit(transactionToEdit: TransactionOutput) {
    onOpenChange(false);
    onEdit(transactionToEdit);
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="gap-0 data-[side=right]:w-full! sm:data-[side=right]:w-3/4! sm:max-w-xl!"
        showCloseButton={false}
      >
        <Button
          aria-label="Fechar detalhes"
          className="absolute top-3 right-3 z-10 max-sm:size-11"
          onClick={() => onOpenChange(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
        <SheetHeader className="shrink-0 px-14 pt-8 pb-0 sm:border-b sm:p-4 sm:pr-14">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <EstablishmentLogo name={detail?.name ?? "Lançamento"} />
            <div className="min-w-0 w-full text-center sm:flex-1 sm:text-left">
              <SheetTitle className="break-words text-base">
                {detail?.name ?? "Detalhes do lançamento"}
              </SheetTitle>
              <SheetDescription className="sr-only sm:not-sr-only">
                {detail ? formatDate(detail.purchaseDate) : "Carregando lançamento…"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {!detail ? (
            <TransactionDetailsSkeleton />
          ) : (
            <div className="grid gap-6 p-5 pt-3 sm:gap-5 sm:p-4">
              {detailQuery.isError ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <p className="font-medium">Os dados mais recentes não puderam ser carregados.</p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    As informações exibidas podem estar desatualizadas.
                  </p>
                </div>
              ) : null}

              <TransactionSummary transaction={detail} />

              <DetailsSection icon={<ReceiptText />} title="Informações">
                <DetailRow label="Tipo" value={<TransactionTypeBadge type={detail.type} />} />
                <DetailRow label="Data da compra" value={formatDate(detail.purchaseDate)} />
                <DetailRow label="Competência" value={formatPeriod(detail.period)} />
                <DetailRow label="Condição" value={transactionConditionLabels[detail.condition]} />
                <DetailRow
                  label="Forma de pagamento"
                  value={formatPaymentMethod(detail.paymentMethod, detail.origin)}
                />
                <DetailRow label="Origem" value={transactionOriginLabels[detail.origin]} />
              </DetailsSection>

              <DetailsSection icon={<Layers3 />} title="Classificação">
                <DetailRow
                  label="Categoria"
                  value={
                    detail.categoryName ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-full bg-muted">
                          <CategoryIcon className="size-4" name={detail.categoryIcon} />
                        </span>
                        {detail.categoryName}
                      </span>
                    ) : (
                      "Não se aplica"
                    )
                  }
                />
                <DetailRow
                  label="Responsável"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage alt="" src={detail.personAvatarUrl ?? undefined} />
                        <AvatarFallback>
                          {detail.personName.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {detail.personName}
                    </span>
                  }
                />
                {detail.type === "transfer" ? (
                  <>
                    <DetailRow
                      label="Conta de origem"
                      value={
                        <FinancialRelation
                          kind="account"
                          logo={detail.sourceAccountLogo}
                          name={detail.sourceAccountName}
                        />
                      }
                    />
                    <DetailRow
                      label="Conta de destino"
                      value={
                        <FinancialRelation
                          kind="account"
                          logo={detail.destinationAccountLogo}
                          name={detail.destinationAccountName}
                        />
                      }
                    />
                  </>
                ) : (
                  <DetailRow
                    label={detail.cardName ? "Cartão" : "Conta"}
                    value={
                      <FinancialRelation
                        kind={detail.cardName ? "card" : "account"}
                        logo={detail.cardLogo ?? detail.accountLogo}
                        name={detail.cardName ?? detail.accountName}
                      />
                    }
                  />
                )}
                {detail.invoicePaymentCardName ? (
                  <DetailRow
                    label="Fatura paga"
                    value={
                      <FinancialRelation
                        kind="card"
                        logo={detail.invoicePaymentCardLogo}
                        name={detail.invoicePaymentCardName}
                      />
                    }
                  />
                ) : null}
              </DetailsSection>

              {detail.condition === "installment" &&
              detail.currentInstallment !== null &&
              detail.installmentCount !== null ? (
                <DetailsSection icon={<CalendarDays />} title="Parcelamento">
                  <DetailRow
                    label="Parcela"
                    value={`${detail.currentInstallment} de ${detail.installmentCount}`}
                  />
                  <DetailRow label="Fatura" value={formatPeriod(detail.period)} />
                  {detail.installmentEndPeriod ? (
                    <DetailRow
                      label="Previsão de término"
                      value={formatPeriod(detail.installmentEndPeriod)}
                    />
                  ) : null}
                  <DetailRow
                    label="Antecipação"
                    value={detail.anticipationId ? "Parcela antecipada" : "Não antecipada"}
                  />
                </DetailsSection>
              ) : null}

              {detail.condition === "recurring" && detail.recurrenceFrequency ? (
                <DetailsSection icon={<RefreshCw />} title="Recorrência">
                  <DetailRow
                    label="Frequência"
                    value={recurrenceFrequencyLabels[detail.recurrenceFrequency]}
                  />
                  <DetailRow label="Ocorrência" value={formatDate(detail.purchaseDate)} />
                </DetailsSection>
              ) : null}

              {detail.paymentMethod === "boleto" && (detail.dueDate || detail.boletoPaymentDate) ? (
                <DetailsSection icon={<Clock3 />} title="Boleto">
                  {detail.dueDate ? (
                    <DetailRow label="Vencimento" value={formatDate(detail.dueDate)} />
                  ) : null}
                  {detail.boletoPaymentDate ? (
                    <DetailRow
                      label="Data do pagamento"
                      value={formatDate(detail.boletoPaymentDate)}
                    />
                  ) : null}
                </DetailsSection>
              ) : null}

              {detail.splitShares.length > 0 ? (
                <section aria-labelledby="transaction-details-split" className="grid gap-2">
                  <SectionTitle icon={<Users />} id="transaction-details-split">
                    Divisão
                  </SectionTitle>
                  <div className="grid gap-1 rounded-xl border p-2">
                    {detail.splitShares.map((share) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
                        key={share.personId}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Avatar size="sm">
                            <AvatarImage alt="" src={share.personAvatarUrl ?? undefined} />
                            <AvatarFallback>
                              {share.personName.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{share.personName}</span>
                        </span>
                        <MoneyValue amount={share.amount} className="shrink-0 font-medium" />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail.refundedAmount > 0 ? (
                <DetailsSection icon={<RefreshCw />} title="Reembolsos">
                  <DetailRow
                    label="Valor reembolsado"
                    value={<MoneyValue amount={detail.refundedAmount} />}
                  />
                  <DetailRow
                    label="Ainda reembolsável"
                    value={<MoneyValue amount={detail.refundableAmount} />}
                  />
                </DetailsSection>
              ) : null}

              {detail.note ? (
                <section aria-labelledby="transaction-details-note" className="grid gap-2">
                  <SectionTitle icon={<FileText />} id="transaction-details-note">
                    Observação
                  </SectionTitle>
                  <p className="whitespace-pre-wrap wrap-break-word rounded-xl border p-3 text-sm leading-relaxed">
                    {detail.note}
                  </p>
                </section>
              ) : null}

              {detail.hasAttachments && detail.recordId ? (
                <section aria-labelledby="transaction-details-attachments" className="grid gap-2">
                  <SectionTitle icon={<Paperclip />} id="transaction-details-attachments">
                    Anexos
                  </SectionTitle>
                  <TransactionAttachments readOnly transactionId={detail.recordId} />
                </section>
              ) : null}

              {detail.createdAt || detail.updatedAt ? (
                <div className="grid gap-1 border-t pt-4 text-muted-foreground text-xs">
                  {detail.createdAt ? (
                    <span>Criado em {formatDateTime(detail.createdAt)}</span>
                  ) : null}
                  {detail.updatedAt && detail.updatedAt !== detail.createdAt ? (
                    <span>Atualizado em {formatDateTime(detail.updatedAt)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "grid w-full gap-2 sm:ml-auto sm:flex sm:w-auto",
              canEdit ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <Button
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Fechar
            </Button>
            {canEdit ? (
              <Button className="w-full sm:w-auto" onClick={() => edit(detail)} type="button">
                <Pencil aria-hidden="true" />
                Editar lançamento
              </Button>
            ) : null}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TransactionSummary({ transaction }: { transaction: TransactionOutput }) {
  const status =
    transaction.isSettled === null
      ? { label: "Pagamento pela fatura", className: "bg-secondary text-secondary-foreground" }
      : transaction.isSettled
        ? {
            label:
              transaction.type === "income"
                ? "Recebido"
                : transaction.type === "transfer"
                  ? "Realizada"
                  : "Pago",
            className: "bg-success/10 text-success",
          }
        : { label: "Em aberto", className: "bg-warning/10 text-foreground" };
  const amountClassName =
    transaction.type === "income"
      ? "text-success"
      : transaction.type === "transfer"
        ? "text-info"
        : "text-foreground";

  return (
    <section className="min-w-0 pb-3 sm:rounded-xl sm:border sm:bg-muted/30 sm:p-4">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="min-w-0">
          <p className="sr-only sm:not-sr-only sm:text-muted-foreground sm:text-xs">
            Total do lançamento
          </p>
          <MoneyValue
            amount={transaction.amount}
            className={cn(
              "block max-w-full break-all text-3xl font-semibold tracking-tight sm:mt-1 sm:text-2xl",
              amountClassName,
            )}
            showPositiveSign={transaction.type === "income"}
          />
        </div>
        <Badge className={status.className} variant="secondary">
          {transaction.isSettled === null ? (
            <CreditCard aria-hidden="true" />
          ) : transaction.isSettled ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          )}
          {status.label}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2 sm:mt-4 sm:justify-start">
        <span className="hidden sm:contents">
          <TransactionTypeBadge type={transaction.type} />
          <Badge variant="outline">{transactionConditionLabels[transaction.condition]}</Badge>
        </span>
        {transaction.origin === "refund" ? <Badge variant="secondary">Reembolso</Badge> : null}
        {transaction.anticipationId ? <Badge variant="secondary">Antecipada</Badge> : null}
        {transaction.isDivided ? <Badge variant="secondary">Dividido</Badge> : null}
      </div>
    </section>
  );
}

function DetailsSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  const id = `transaction-details-${title.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}`;

  return (
    <section aria-labelledby={id} className="grid gap-2">
      <SectionTitle icon={icon} id={id}>
        {title}
      </SectionTitle>
      <dl className="grid min-w-0 gap-0 sm:rounded-xl sm:border sm:px-3">{children}</dl>
    </section>
  );
}

function SectionTitle({
  children,
  icon,
  id,
}: {
  children: ReactNode;
  icon: ReactNode;
  id: string;
}) {
  return (
    <h3
      className="flex items-center gap-2 font-medium text-muted-foreground text-xs sm:text-foreground sm:text-sm"
      id={id}
    >
      <span className="hidden text-muted-foreground sm:inline [&>svg]:size-4">{icon}</span>
      {children}
    </h3>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground text-xs sm:text-sm">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 break-words text-right text-xs sm:text-sm">
        {value}
      </dd>
    </div>
  );
}

function FinancialRelation({
  kind,
  logo,
  name,
}: {
  kind: "account" | "card";
  logo: string | null;
  name: string | null;
}) {
  if (!name) return <span>Não se aplica</span>;
  const FallbackIcon = kind === "card" ? CreditCard : Landmark;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {logo ? (
        <Image
          alt={`Logo de ${name}`}
          className="size-7 shrink-0 rounded-full object-contain"
          height={28}
          layout="fixed"
          src={logo}
          width={28}
        />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <FallbackIcon aria-hidden="true" className="size-3.5" />
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

function TransactionDetailsSkeleton() {
  return (
    <div aria-label="Carregando detalhes do lançamento" className="grid gap-5 p-4" role="status">
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

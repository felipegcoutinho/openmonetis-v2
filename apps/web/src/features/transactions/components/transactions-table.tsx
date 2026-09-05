import {
  balanceAdjustmentCategoryName,
  internalTransferCategoryName,
  invoicePaymentCategoryName,
  yieldCategoryName,
} from "@openmonetis/domain/categories";
import { canDeleteTransactionOrigin } from "@openmonetis/domain/transactions";
import type {
  TransactionActionScope,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import {
  BadgeDollarSign,
  Banknote,
  Barcode,
  CalendarArrowDown,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  CircleCheck,
  CircleDollarSign,
  Copy,
  CreditCard,
  Eye,
  Landmark,
  Loader2,
  MessageSquareMore,
  Minus,
  MoreHorizontal,
  Paperclip,
  PartyPopper,
  Pause,
  Pencil,
  QrCode,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import {
  formatCompactDate,
  formatPaymentMethodTable,
  groupTransactionRows,
  transactionConditionLabels,
} from "../transactions.presentation";
import { InstallmentActionDialog } from "./installment-action-dialog";

type TransactionsTableProps = {
  adminPersonId: string | null;
  transactions: TransactionOutput[];
  pendingTransactionId: string | null;
  pendingSettlementKey: string | null;
  onEdit: (transaction: TransactionOutput) => void;
  onView: (transaction: TransactionOutput) => void;
  onDelete: (id: string, scope?: TransactionActionScope) => void;
  onCopy: (transaction: TransactionOutput) => void;
  onAnticipate: (transaction: TransactionOutput) => void;
  onUndoAnticipation: (transaction: TransactionOutput) => void;
  onRefund: (transaction: TransactionOutput) => void;
  onSettle: (ids: string[], isSettled: boolean) => void;
  onSettleRecurringOccurrence: (
    recurringRuleId: string,
    purchaseDate: string,
    isSettled: boolean,
  ) => void;
  onRecurringStatus: (id: string, status: "active" | "paused" | "cancelled") => void;
  currentPage: number;
  pageCount: number;
  pageSize: number;
  period: string;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function TransactionsTable({
  adminPersonId,
  transactions,
  pendingTransactionId,
  pendingSettlementKey,
  onEdit,
  onView,
  onDelete,
  onCopy,
  onAnticipate,
  onUndoAnticipation,
  onRefund,
  onSettle,
  onSettleRecurringOccurrence,
  onRecurringStatus,
  currentPage,
  pageCount,
  pageSize,
  period,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TransactionsTableProps) {
  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <Card className="py-2">
          <CardContent className="px-2 sm:px-4">
            {transactions.length ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Condição</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Conta/Cartão</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupTransactionRows(transactions).map(({ transaction, splitConnector }) => (
                        <TransactionRow
                          adminPersonId={adminPersonId}
                          key={transaction.id}
                          splitConnector={splitConnector}
                          onEdit={onEdit}
                          onView={onView}
                          onDelete={onDelete}
                          onCopy={onCopy}
                          onAnticipate={onAnticipate}
                          onUndoAnticipation={onUndoAnticipation}
                          onRefund={onRefund}
                          onRecurringStatus={onRecurringStatus}
                          onSettle={onSettle}
                          onSettleRecurringOccurrence={onSettleRecurringOccurrence}
                          pending={
                            pendingTransactionId !== null &&
                            pendingTransactionId === transaction.recordId
                          }
                          period={period}
                          settlementPending={
                            pendingSettlementKey ===
                            (transaction.recordId ??
                              (transaction.recurringRuleId
                                ? `${transaction.recurringRuleId}:${transaction.purchaseDate}`
                                : null))
                          }
                          transaction={transaction}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex flex-col items-center justify-between gap-3 border-t px-1 pt-3 text-sm sm:flex-row">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{totalItems} lançamentos</span>
                    <Select
                      onValueChange={(value) => value && onPageSizeChange(Number(value))}
                      value={String(pageSize)}
                    >
                      <SelectTrigger aria-label="Lançamentos por página" className="h-8 w-20">
                        <SelectValue>{pageSize}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 30, 40, 50, 100].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-2 text-muted-foreground">
                      Página {currentPage} de {pageCount}
                    </span>
                    <Button
                      aria-label="Primeira página"
                      disabled={currentPage === 1}
                      onClick={() => onPageChange(1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronsLeft />
                    </Button>
                    <Button
                      aria-label="Página anterior"
                      disabled={currentPage === 1}
                      onClick={() => onPageChange(currentPage - 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      aria-label="Próxima página"
                      disabled={currentPage === pageCount}
                      onClick={() => onPageChange(currentPage + 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronRight />
                    </Button>
                    <Button
                      aria-label="Última página"
                      disabled={currentPage === pageCount}
                      onClick={() => onPageChange(pageCount)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronsRight />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid place-items-center px-4 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand-strong">
                  <CircleDollarSign className="size-6" />
                </span>
                <h2 className="mt-4 font-semibold">Nenhum lançamento encontrado</h2>
                <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                  Ajuste os filtros ou cadastre um novo lançamento para visualizar aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

type TransactionRowProps = {
  adminPersonId: string | null;
  splitConnector: "start" | "middle" | "end" | null;
  transaction: TransactionOutput;
  pending: boolean;
  period: string;
  settlementPending: boolean;
  onEdit: (transaction: TransactionOutput) => void;
  onView: (transaction: TransactionOutput) => void;
  onDelete: (id: string, scope?: TransactionActionScope) => void;
  onCopy: (transaction: TransactionOutput) => void;
  onAnticipate: (transaction: TransactionOutput) => void;
  onUndoAnticipation: (transaction: TransactionOutput) => void;
  onRefund: (transaction: TransactionOutput) => void;
  onRecurringStatus: (id: string, status: "active" | "paused" | "cancelled") => void;
  onSettle: (ids: string[], isSettled: boolean) => void;
  onSettleRecurringOccurrence: (
    recurringRuleId: string,
    purchaseDate: string,
    isSettled: boolean,
  ) => void;
};

function TransactionRow({
  adminPersonId,
  splitConnector,
  transaction,
  pending,
  period,
  settlementPending,
  onEdit,
  onView,
  onDelete,
  onCopy,
  onAnticipate,
  onUndoAnticipation,
  onRefund,
  onRecurringStatus,
  onSettle,
  onSettleRecurringOccurrence,
}: TransactionRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installmentDeleteOpen, setInstallmentDeleteOpen] = useState(false);
  const visibleAmount = transaction.allocation?.amount ?? transaction.amount;
  const isIncomingTransfer = transaction.type === "transfer" && visibleAmount > 0;
  const amountClassName =
    transaction.type === "income"
      ? "text-success"
      : transaction.type === "transfer"
        ? "text-info"
        : "text-foreground";
  const PaymentIcon =
    transaction.paymentMethod === null
      ? Minus
      : transaction.paymentMethod === "credit_card" || transaction.paymentMethod === "debit_card"
        ? CreditCard
        : transaction.paymentMethod === "boleto"
          ? Barcode
          : transaction.paymentMethod === "pix"
            ? QrCode
            : transaction.paymentMethod === "cash"
              ? Banknote
              : Landmark;
  const isInvoicePayment = transaction.categoryName === invoicePaymentCategoryName;
  const categoryLabel =
    transaction.categoryName === internalTransferCategoryName
      ? "Transf. interna"
      : transaction.categoryName;
  const isInvoiceAdjustment = transaction.origin === "invoiceAdjustment";
  const isBalanceAdjustment =
    transaction.categoryName === balanceAdjustmentCategoryName ||
    transaction.paymentMethod === null;
  const isAccountYield =
    transaction.type === "income" &&
    transaction.categoryName === yieldCategoryName &&
    transaction.accountId !== null;
  const featuredLogo = isInvoicePayment
    ? transaction.invoicePaymentCardLogo
    : isInvoiceAdjustment
      ? transaction.cardLogo
      : isBalanceAdjustment || isAccountYield
        ? (transaction.accountLogo ?? transaction.cardLogo)
        : null;
  const featuredLogoName = isInvoicePayment
    ? (transaction.invoicePaymentCardName ?? "cartão")
    : isInvoiceAdjustment
      ? (transaction.cardName ?? "cartão")
      : (transaction.accountName ?? transaction.cardName ?? "conta");
  const isRefund = transaction.origin === "refund";
  const isGenerated = transaction.origin !== "regular";
  const isLastInstallment =
    transaction.condition === "installment" &&
    transaction.currentInstallment !== null &&
    transaction.installmentCount !== null &&
    transaction.installmentCount > 1 &&
    transaction.currentInstallment === transaction.installmentCount;
  const canDelete = canDeleteTransactionOrigin(transaction.origin);
  const isPaymentControlledByInvoice =
    transaction.paymentMethod === "credit_card" || transaction.isSettled === null;
  const shouldShowPersonContext =
    transaction.allocation !== null ||
    transaction.isDivided ||
    (adminPersonId !== null && transaction.personId !== adminPersonId);
  const showPurchaseDate = transaction.paymentMethod !== "boleto";
  const settlementTooltip = isBalanceAdjustment
    ? "Ajustes de saldo são sempre confirmados."
    : isInvoicePayment
      ? "Este pagamento já foi conciliado com a fatura."
      : isGenerated
        ? "Este lançamento é controlado automaticamente pelo sistema."
        : transaction.isSettled
          ? "Desfazer o pagamento e marcar como em aberto."
          : "Marcar este lançamento como pago.";

  return (
    <TableRow
      className={cn(
        isInvoicePayment ? "bg-muted/30" : isRefund ? "bg-success/5" : undefined,
        splitConnector && splitConnector !== "end" && "border-b-0",
      )}
    >
      <TableCell>
        <div className="relative flex min-w-64 items-center gap-2.5">
          {splitConnector && splitConnector !== "end" ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 z-10 h-11 w-px opacity-50"
              style={{ backgroundColor: "var(--muted-foreground)" }}
            />
          ) : null}
          <span className="relative z-20 inline-flex shrink-0 rounded-full bg-card">
            {featuredLogo ? (
              <Image
                alt={`Logo de ${featuredLogoName}`}
                className="size-8 shrink-0 rounded-full object-contain"
                height={32}
                layout="fixed"
                src={featuredLogo}
                width={32}
              />
            ) : (
              <EstablishmentLogo name={transaction.name} />
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex h-5 items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      className="max-w-60 cursor-pointer truncate rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onView(transaction)}
                      type="button"
                    />
                  }
                >
                  {transaction.name}
                </TooltipTrigger>
                <TooltipContent>{transaction.name}</TooltipContent>
              </Tooltip>
              {transaction.condition === "installment" &&
              transaction.currentInstallment &&
              transaction.installmentCount ? (
                <span className="rounded-md border px-1.5 py-0.5 font-medium text-xs text-muted-foreground">
                  {transaction.currentInstallment} de {transaction.installmentCount}
                </span>
              ) : null}
              {isLastInstallment ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Última parcela"
                    render={<span className="inline-flex text-brand-strong" role="img" />}
                  >
                    <PartyPopper aria-hidden="true" className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>Última parcela!</TooltipContent>
                </Tooltip>
              ) : null}
              {transaction.hasAttachments ? (
                <Paperclip className="size-3.5" aria-label="Possui anexos" />
              ) : null}
              {transaction.note ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Ver observação"
                    render={<span className="inline-flex rounded-sm p-0.5 text-muted-foreground" />}
                  >
                    <MessageSquareMore aria-hidden="true" className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs whitespace-pre-wrap">
                    {transaction.note}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {transaction.refundedAmount > 0 ? (
                <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-medium text-success text-xs">
                  {transaction.refundableAmount === 0 ? "Reembolsado" : "Reembolso parcial"}
                </span>
              ) : null}
              {transaction.anticipationId ? (
                <span className="rounded-md bg-brand/10 px-1.5 py-0.5 font-medium text-brand-strong text-xs">
                  Antecipada
                </span>
              ) : null}
              {shouldShowPersonContext ? (
                <span className="ml-1">
                  <TransactionPeople transaction={transaction} />
                </span>
              ) : null}
            </span>
            <span className="flex h-4 items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs">
              {showPurchaseDate ? formatCompactDate(transaction.purchaseDate) : null}
              {transaction.categoryName ? (
                <>
                  {showPurchaseDate ? <span aria-hidden="true">·</span> : null}
                  <TransactionCategory
                    categoryLabel={categoryLabel}
                    period={period}
                    transaction={transaction}
                  />
                </>
              ) : null}
              {transaction.dueDate ? (
                <span className="text-brand-strong">
                  {showPurchaseDate || transaction.categoryName ? "· " : null}
                  Venc. {formatCompactDate(transaction.dueDate)}
                </span>
              ) : null}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="sr-only">
          {isRefund
            ? "Reembolso"
            : transaction.type === "income"
              ? "Receita"
              : transaction.type === "expense"
                ? "Despesa"
                : "Transferência"}
          :
        </span>
        <MoneyValue
          amount={visibleAmount}
          className={`font-medium ${amountClassName}`}
          showPositiveSign={transaction.type === "income" || isIncomingTransfer}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          {transaction.isRecurring ? (
            <RefreshCw aria-hidden="true" className="size-4" />
          ) : transaction.condition === "installment" ? (
            <CalendarClock aria-hidden="true" className="size-4" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          {transactionConditionLabels[transaction.condition]}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <PaymentIcon aria-hidden="true" className="size-4" />
          {formatPaymentMethodTable(transaction.paymentMethod)}
        </span>
      </TableCell>
      <TableCell>
        <TransactionRelation transaction={transaction} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {isPaymentControlledByInvoice ? (
            <Tooltip>
              <TooltipTrigger
                aria-label="Pagamento conciliado pela fatura"
                render={
                  <span className="inline-flex size-8 items-center justify-center text-muted-foreground" />
                }
              >
                <CreditCard aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent>O pagamento é controlado pela fatura do cartão.</TooltipContent>
            </Tooltip>
          ) : transaction.isSettled !== null ? (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button
                  aria-label={
                    isBalanceAdjustment
                      ? "Ajuste de saldo sempre confirmado"
                      : transaction.isSettled
                        ? "Marcar em aberto"
                        : "Marcar como pago"
                  }
                  disabled={
                    isInvoicePayment || isBalanceAdjustment || isGenerated || settlementPending
                  }
                  onClick={() => {
                    if (transaction.recordId) {
                      onSettle([transaction.recordId], !transaction.isSettled);
                    } else if (transaction.recurringRuleId) {
                      onSettleRecurringOccurrence(
                        transaction.recurringRuleId,
                        transaction.purchaseDate,
                        !transaction.isSettled,
                      );
                    }
                  }}
                  size="icon"
                  type="button"
                  className={
                    transaction.isSettled
                      ? "bg-success/10 text-success"
                      : "text-muted-foreground hover:text-success"
                  }
                  variant="ghost"
                >
                  {settlementPending ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : transaction.isSettled ? (
                    <CircleCheck aria-hidden="true" className="size-4" />
                  ) : (
                    <Circle aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{settlementTooltip}</TooltipContent>
            </Tooltip>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Ações de ${transaction.name}`}
                  disabled={pending}
                  size="icon"
                  variant="ghost"
                />
              }
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView(transaction)}>
                <Eye />
                Ver detalhes
              </DropdownMenuItem>
              {transaction.seriesId && transaction.anticipationId ? (
                <DropdownMenuItem onClick={() => onUndoAnticipation(transaction)}>
                  <RotateCcw />
                  Desfazer antecipação
                </DropdownMenuItem>
              ) : null}
              {transaction.recordId &&
              transaction.seriesId &&
              !transaction.anticipationId &&
              transaction.type === "expense" &&
              transaction.origin === "regular" &&
              transaction.condition === "installment" &&
              transaction.paymentMethod === "credit_card" &&
              transaction.currentInstallment !== null &&
              transaction.installmentCount !== null &&
              transaction.currentInstallment < transaction.installmentCount ? (
                <DropdownMenuItem onClick={() => onAnticipate(transaction)}>
                  <CalendarArrowDown />
                  Antecipar parcelas
                </DropdownMenuItem>
              ) : null}
              {transaction.recordId &&
              transaction.type === "expense" &&
              transaction.origin === "regular" &&
              transaction.refundableAmount > 0 ? (
                <DropdownMenuItem onClick={() => onRefund(transaction)}>
                  <BadgeDollarSign />
                  Registrar reembolso
                </DropdownMenuItem>
              ) : null}
              {!isBalanceAdjustment && !isGenerated ? (
                <DropdownMenuItem onClick={() => onEdit(transaction)}>
                  <Pencil />
                  Editar
                </DropdownMenuItem>
              ) : null}
              {transaction.recordId && !isBalanceAdjustment && !isGenerated ? (
                <DropdownMenuItem onClick={() => onCopy(transaction)}>
                  <Copy />
                  Copiar
                </DropdownMenuItem>
              ) : null}
              {transaction.recurringRuleId ? (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      onRecurringStatus(transaction.recurringRuleId as string, "paused")
                    }
                  >
                    <Pause />
                    Pausar recorrência
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      onRecurringStatus(transaction.recurringRuleId as string, "cancelled")
                    }
                    variant="destructive"
                  >
                    <Trash2 />
                    Encerrar recorrência
                  </DropdownMenuItem>
                </>
              ) : null}
              {transaction.recordId && canDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (transaction.seriesId && transaction.condition === "installment") {
                        setInstallmentDeleteOpen(true);
                      } else {
                        setDeleteOpen(true);
                      }
                    }}
                    variant="destructive"
                  >
                    <Trash2 />
                    {isRefund
                      ? "Remover reembolso"
                      : isBalanceAdjustment
                        ? "Remover ajuste"
                        : "Remover lançamento"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isRefund
                    ? "Remover reembolso?"
                    : isBalanceAdjustment
                      ? "Remover ajuste de saldo?"
                      : "Remover lançamento?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isRefund
                    ? `O reembolso de “${transaction.name.replace(/^Reembolso · /, "")}” será desfeito.`
                    : isBalanceAdjustment
                      ? "O lançamento de ajuste será removido e o saldo da conta será recalculado."
                      : `O lançamento “${transaction.name}” será removido desta base.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={() => onDelete(transaction.recordId ?? "", "single")}
                  variant="destructive"
                >
                  {isBalanceAdjustment ? "Remover ajuste" : "Remover lançamento"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <InstallmentActionDialog
            action="delete"
            key={`delete-${transaction.id}`}
            onConfirm={async (scope) => {
              await onDelete(transaction.recordId ?? "", scope);
              setInstallmentDeleteOpen(false);
            }}
            onOpenChange={setInstallmentDeleteOpen}
            open={installmentDeleteOpen}
            pending={pending}
            transaction={transaction}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function TransactionCategory({
  categoryLabel,
  period,
  transaction,
}: {
  categoryLabel: string | null;
  period: string;
  transaction: TransactionOutput;
}) {
  if (!categoryLabel) return null;

  const content = (
    <>
      <CategoryIcon aria-hidden="true" className="size-3.5" name={transaction.categoryIcon} />
      <span>{categoryLabel}</span>
    </>
  );

  if (!transaction.categoryId) {
    return <span className="inline-flex items-center gap-1">{content}</span>;
  }

  return (
    <Link
      className="inline-flex items-center gap-1 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      params={{ categoryId: transaction.categoryId }}
      search={{ period }}
      to="/categories/$categoryId"
    >
      {content}
    </Link>
  );
}

function TransactionPeople({ transaction }: { transaction: TransactionOutput }) {
  if (transaction.allocation) {
    return (
      <PersonLink
        avatarUrl={transaction.allocation.personAvatarUrl}
        id={transaction.allocation.personId}
        name={transaction.allocation.personName}
      />
    );
  }

  if (!transaction.isDivided || transaction.splitShares.length === 0) {
    return (
      <PersonLink
        avatarUrl={transaction.personAvatarUrl}
        id={transaction.personId}
        name={transaction.personName}
      />
    );
  }

  const visibleShares = transaction.splitShares.slice(0, 3);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex items-center gap-2 rounded-sm">
            <span className="flex -space-x-1.5">
              {visibleShares.map((share) => (
                <Link
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={share.personId}
                  params={{ personId: share.personId }}
                  to="/people/$personId"
                >
                  <Avatar className="size-5 bg-background" showBorder size="sm">
                    <AvatarImage
                      alt={`Avatar de ${share.personName}`}
                      src={share.personAvatarUrl ?? undefined}
                    />
                    <AvatarFallback>{share.personName.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
              ))}
            </span>
          </span>
        }
      />
      <TooltipContent className="grid gap-1">
        {transaction.splitShares.map((share) => (
          <span className="flex items-center justify-between gap-4" key={share.personId}>
            <span>{share.personName}</span>
            <MoneyValue amount={share.amount} />
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function PersonLink({
  avatarUrl,
  id,
  name,
}: {
  avatarUrl: string | null;
  id: string;
  name: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Pessoa: ${name}`}
        render={
          <Link
            className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            params={{ personId: id }}
            to="/people/$personId"
          />
        }
      >
        <Avatar className="size-5" showBorder={false} size="sm">
          <AvatarImage alt="" src={avatarUrl ?? undefined} />
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

function TransactionRelation({ transaction }: { transaction: TransactionOutput }) {
  if (transaction.type === "transfer") {
    return (
      <RelationLink
        id={transaction.accountId}
        logo={transaction.accountLogo}
        name={transaction.accountName}
        to="/accounts/$accountId"
      />
    );
  }

  if (transaction.cardId && transaction.cardName) {
    return (
      <RelationLink
        id={transaction.cardId}
        logo={transaction.cardLogo}
        name={transaction.cardName}
        to="/cards/$cardId"
      />
    );
  }

  return (
    <RelationLink
      id={transaction.accountId}
      logo={transaction.accountLogo}
      name={transaction.accountName}
      to="/accounts/$accountId"
    />
  );
}

function RelationLink({
  id,
  logo,
  name,
  to,
}: {
  id: string | null;
  logo: string | null;
  name: string | null;
  to: "/accounts/$accountId" | "/cards/$cardId";
}) {
  if (!id || !name) {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <CircleDollarSign className="size-4" />
        </span>
        —
      </span>
    );
  }

  const content = (
    <>
      {logo ? (
        <Image
          alt=""
          className="size-7 rounded-full object-contain"
          height={28}
          layout="fixed"
          src={logo}
          width={28}
        />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <CircleDollarSign className="size-4" />
        </span>
      )}
      <span className="max-w-32 truncate">{name}</span>
    </>
  );

  if (to === "/cards/$cardId") {
    return (
      <Link
        className="inline-flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        params={{ cardId: id }}
        to={to}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      className="inline-flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      params={{ accountId: id }}
      to={to}
    >
      {content}
    </Link>
  );
}

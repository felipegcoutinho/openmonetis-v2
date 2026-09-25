import {
  balanceAdjustmentCategoryName,
  invoicePaymentCategoryName,
  yieldCategoryName,
} from "@openmonetis/domain/categories";
import { canDeleteTransactionOrigin } from "@openmonetis/domain/transactions";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  TransactionActionScope,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import {
  BadgeDollarSign,
  CalendarArrowDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  Copy,
  CreditCard,
  Eye,
  FileUp,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import { formatPaymentMethodTable } from "../transactions.presentation";
import { useTransactionSelection } from "../useTransactionSelection";
import { InstallmentActionDialog } from "./installment-action-dialog";
import { RecurringStatusDialog } from "./recurring-status-dialog";
import { TransactionSelectionSummary } from "./transaction-selection-summary";

type TransactionsMobileListProps = {
  allowImport?: boolean;
  transactions: TransactionOutput[];
  pendingTransactionId: string | null;
  pendingSettlementKey: string | null;
  currentPage: number;
  pageCount: number;
  totalItems: number;
  onEdit: (transaction: TransactionOutput) => void;
  onView: (transaction: TransactionOutput) => void;
  onDelete: (transaction: TransactionOutput, scope?: TransactionActionScope) => void;
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
  onRecurringStatus: (
    id: string,
    status: "active" | "paused" | "cancelled",
  ) => Promise<void> | void;
  onPageChange: (page: number) => void;
};

export function TransactionsMobileList(props: TransactionsMobileListProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const selection = useTransactionSelection(props.transactions);
  const groups = new Map<string, TransactionOutput[]>();
  for (const transaction of props.transactions) {
    groups.set(transaction.purchaseDate, [
      ...(groups.get(transaction.purchaseDate) ?? []),
      transaction,
    ]);
  }

  if (!props.transactions.length) {
    return (
      <Card className="grid min-h-52 place-items-center border-dashed p-8 text-center">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Circle aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">Nenhum lançamento encontrado</h2>
          <p className="mt-1 text-muted-foreground text-sm">Ajuste os filtros ou crie um novo.</p>
          {props.allowImport ? (
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link to="/transactions/import">
                <FileUp aria-hidden="true" /> Importar extrato
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        {selectionMode ? (
          <>
            <div className="mr-auto flex items-center gap-2 text-sm">
              <Checkbox
                aria-label="Selecionar lançamentos operacionais desta página"
                checked={selection.allSelectableSelected}
                disabled={!selection.selectableCount}
                onCheckedChange={selection.setAllSelectableSelected}
              />
              Selecionar página
            </div>
            <Button
              onClick={() => {
                selection.clear();
                setSelectionMode(false);
              }}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {props.allowImport ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/transactions/import">
                  <FileUp aria-hidden="true" /> Importar extrato
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => setSelectionMode(true)} size="sm" variant="outline">
              <ListChecks aria-hidden="true" /> Selecionar
            </Button>
          </>
        )}
      </div>
      <TransactionSelectionSummary onClear={selection.clear} summary={selection.summary} />
      {[...groups.entries()].map(([date, transactions]) => (
        <section aria-labelledby={`transactions-${date}`} className="grid gap-2" key={date}>
          <h2
            className="px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide"
            id={`transactions-${date}`}
          >
            {formatGroupDate(date)}
          </h2>
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y">
              {transactions.map((transaction) => (
                <MobileTransactionRow
                  key={transaction.id}
                  {...props}
                  onSelectionChange={(selected) => selection.setSelected(transaction.id, selected)}
                  selected={selection.isSelected(transaction.id)}
                  selectable={selection.isSelectable(transaction)}
                  selectionMode={selectionMode}
                  transaction={transaction}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <footer className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{props.totalItems} lançamentos</span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Página anterior"
            disabled={props.currentPage === 1}
            onClick={() => props.onPageChange(props.currentPage - 1)}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-16 text-center text-muted-foreground text-xs">
            {props.currentPage} de {props.pageCount}
          </span>
          <Button
            aria-label="Próxima página"
            disabled={props.currentPage === props.pageCount}
            onClick={() => props.onPageChange(props.currentPage + 1)}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

function MobileTransactionRow({
  transaction,
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
  selectionMode,
  selected,
  selectable,
  onSelectionChange,
}: TransactionsMobileListProps & {
  transaction: TransactionOutput;
  selectionMode: boolean;
  selected: boolean;
  selectable: boolean;
  onSelectionChange: (selected: boolean) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installmentDeleteOpen, setInstallmentDeleteOpen] = useState(false);
  const [recurringAction, setRecurringAction] = useState<"pause" | "cancel" | null>(null);
  const visibleAmount = transaction.allocation?.amount ?? transaction.amount;
  const isBalanceAdjustment =
    transaction.categoryName === balanceAdjustmentCategoryName ||
    transaction.paymentMethod === null;
  const isInvoicePayment = transaction.categoryName === invoicePaymentCategoryName;
  const isInvoiceAdjustment = transaction.origin === "invoiceAdjustment";
  const isAccountYield =
    transaction.type === "income" &&
    transaction.categoryName === yieldCategoryName &&
    transaction.accountId !== null;
  const isGenerated = transaction.origin !== "regular";
  const canDelete = isInvoiceAdjustment || canDeleteTransactionOrigin(transaction.origin);
  const paymentControlledByInvoice =
    transaction.paymentMethod === "credit_card" || transaction.isSettled === null;
  const pending = pendingTransactionId === transaction.recordId;
  const settlementKey =
    transaction.recordId ??
    (transaction.recurringRuleId
      ? `${transaction.recurringRuleId}:${transaction.purchaseDate}`
      : null);
  const settlementPending = pendingSettlementKey === settlementKey;
  const featuredLogo = isInvoicePayment
    ? transaction.invoicePaymentCardLogo
    : isInvoiceAdjustment
      ? transaction.cardLogo
      : isBalanceAdjustment || isAccountYield
        ? (transaction.accountLogo ?? transaction.cardLogo)
        : null;
  const relation = transaction.cardName ?? transaction.accountName;
  const canAnticipate =
    transaction.recordId &&
    transaction.seriesId &&
    !transaction.anticipationId &&
    transaction.type === "expense" &&
    transaction.origin === "regular" &&
    transaction.condition === "installment" &&
    transaction.paymentMethod === "credit_card" &&
    transaction.currentInstallment !== null &&
    transaction.installmentCount !== null &&
    transaction.currentInstallment < transaction.installmentCount;

  return (
    <li
      className={cn(
        "flex min-h-20 items-center gap-3 px-3 py-3",
        isInvoicePayment && "bg-success/5",
        selected && "bg-brand/5",
      )}
    >
      {selectionMode ? (
        <Checkbox
          aria-label={
            selectable
              ? `Selecionar ${transaction.name}`
              : `${transaction.name} não participa da conferência`
          }
          checked={selected}
          className={cn(!selectable && "opacity-20!")}
          disabled={!selectable}
          onCheckedChange={onSelectionChange}
        />
      ) : null}
      <button
        aria-label={
          selectionMode
            ? selectable
              ? `${selected ? "Remover" : "Adicionar"} ${transaction.name} da seleção`
              : `${transaction.name} não participa da conferência`
            : `Ver detalhes de ${transaction.name}`
        }
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
        disabled={selectionMode && !selectable}
        onClick={() => {
          if (selectionMode) {
            if (selectable) onSelectionChange(!selected);
            return;
          }
          onView(transaction);
        }}
        type="button"
      >
        <span className="shrink-0">
          {featuredLogo ? (
            <Image
              alt=""
              className="size-10 rounded-full object-contain"
              height={40}
              layout="fixed"
              src={featuredLogo}
              width={40}
            />
          ) : (
            <EstablishmentLogo
              editable={false}
              fallback={
                transaction.categoryIcon ? (
                  <CategoryIcon className="size-4" name={transaction.categoryIcon} />
                ) : undefined
              }
              name={transaction.name}
              size={40}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-medium text-sm">{transaction.name}</span>
            {transaction.currentInstallment && transaction.installmentCount ? (
              <span className="shrink-0 text-muted-foreground text-[0.65rem]">
                {transaction.currentInstallment}/{transaction.installmentCount}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {[
              transaction.categoryName,
              relation,
              formatPaymentMethodTable(transaction.paymentMethod, transaction.origin),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <MoneyValue
            amount={visibleAmount}
            className={cn(
              "block font-medium text-sm",
              transaction.type === "income" && "text-success",
              transaction.type === "transfer" && "text-info",
            )}
            showPositiveSign={transaction.type === "income" || visibleAmount > 0}
          />
          <span className="mt-1 flex justify-end">
            {paymentControlledByInvoice ? (
              <CreditCard
                aria-label="Pagamento pela fatura"
                className="size-4 text-muted-foreground"
              />
            ) : transaction.isSettled !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[0.65rem]",
                  transaction.isSettled ? "text-success" : "text-muted-foreground",
                )}
              >
                {transaction.isSettled ? (
                  <CircleCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <Circle aria-hidden="true" className="size-3.5" />
                )}
                {transaction.isSettled ? "Confirmado" : "Em aberto"}
              </span>
            ) : null}
          </span>
        </span>
      </button>

      {selectionMode ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`Ações de ${transaction.name}`}
                disabled={pending}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onView(transaction)}>
              <Eye /> Ver detalhes
            </DropdownMenuItem>
            {!paymentControlledByInvoice && transaction.isSettled !== null && !isGenerated ? (
              <DropdownMenuItem
                disabled={settlementPending}
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
              >
                {settlementPending ? <Loader2 className="animate-spin" /> : <CircleCheck />}
                {transaction.isSettled ? "Marcar em aberto" : "Marcar como pago"}
              </DropdownMenuItem>
            ) : null}
            {transaction.seriesId && transaction.anticipationId ? (
              <DropdownMenuItem onClick={() => onUndoAnticipation(transaction)}>
                <RotateCcw /> Desfazer antecipação
              </DropdownMenuItem>
            ) : null}
            {canAnticipate ? (
              <DropdownMenuItem onClick={() => onAnticipate(transaction)}>
                <CalendarArrowDown /> Antecipar parcelas
              </DropdownMenuItem>
            ) : null}
            {transaction.recordId &&
            transaction.type === "expense" &&
            transaction.origin === "regular" &&
            transaction.refundableAmount > 0 ? (
              <DropdownMenuItem onClick={() => onRefund(transaction)}>
                <BadgeDollarSign /> Registrar reembolso
              </DropdownMenuItem>
            ) : null}
            {!isBalanceAdjustment && !isGenerated ? (
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <Pencil /> Editar
              </DropdownMenuItem>
            ) : null}
            {transaction.recordId && !isBalanceAdjustment && !isGenerated ? (
              <DropdownMenuItem onClick={() => onCopy(transaction)}>
                <Copy /> Copiar
              </DropdownMenuItem>
            ) : null}
            {transaction.recurringRuleId ? (
              <>
                <DropdownMenuItem onClick={() => setRecurringAction("pause")}>
                  <Pause /> Pausar recorrência
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRecurringAction("cancel")}
                  variant="destructive"
                >
                  <Trash2 /> Encerrar recorrência
                </DropdownMenuItem>
              </>
            ) : null}
            {transaction.recordId && canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    transaction.seriesId && transaction.condition === "installment"
                      ? setInstallmentDeleteOpen(true)
                      : setDeleteOpen(true)
                  }
                  variant="destructive"
                >
                  <Trash2 /> Remover lançamento
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento “{transaction.name}” será removido desta base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => onDelete(transaction, "single")}
              variant="destructive"
            >
              Remover lançamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InstallmentActionDialog
        action="delete"
        onConfirm={async (scope) => {
          await onDelete(transaction, scope);
          setInstallmentDeleteOpen(false);
        }}
        onOpenChange={setInstallmentDeleteOpen}
        open={installmentDeleteOpen}
        pending={pending}
        transaction={transaction}
      />
      <RecurringStatusDialog
        action={recurringAction}
        name={transaction.name}
        onConfirm={(action) =>
          onRecurringStatus(
            transaction.recurringRuleId as string,
            action === "pause" ? "paused" : "cancelled",
          )
        }
        onOpenChange={(open) => {
          if (!open) setRecurringAction(null);
        }}
      />
    </li>
  );
}

function formatGroupDate(value: string) {
  const label = formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "long",
    weekday: "long",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

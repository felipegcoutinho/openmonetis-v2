import {
  balanceAdjustmentCategoryName,
  internalTransferCategoryName,
  invoicePaymentCategoryName,
  yieldCategoryName,
} from "@openmonetis/domain/categories";
import { canDeleteTransactionOrigin } from "@openmonetis/domain/transactions";
import { Circle, CircleCheck, CreditCard, Loader2, Minus, Scale } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatPaymentMethodTable,
  paymentMethodIcons,
  transactionConditionIcons,
  transactionConditionLabels,
} from "../transactions.presentation";
import { TransactionActionDialogs } from "./transaction-action-dialogs";
import { TransactionRelation } from "./transaction-relation";
import { TransactionRowActions } from "./transaction-row-actions";
import { TransactionRowDescription } from "./transaction-row-description";
import type { TransactionRowProps } from "./transactions-table.types";

export function TransactionRow({
  period,
  accountStatement,
  adminPersonId,
  selected,
  selectable,
  splitConnector,
  transaction,
  pending,
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
  onSelectionChange,
}: TransactionRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installmentDeleteOpen, setInstallmentDeleteOpen] = useState(false);
  const [recurringAction, setRecurringAction] = useState<"pause" | "cancel" | null>(null);
  const visibleAmount = transaction.allocation?.amount ?? transaction.amount;
  const isIncomingTransfer = transaction.type === "transfer" && visibleAmount > 0;
  const amountClassName =
    transaction.type === "income"
      ? "text-success"
      : transaction.type === "transfer"
        ? "text-info"
        : "text-foreground";
  const ConditionIcon =
    transactionConditionIcons[transaction.isRecurring ? "recurring" : transaction.condition];
  const PaymentIcon =
    transaction.origin === "accountBalanceAdjustment"
      ? Scale
      : transaction.paymentMethod === null
        ? Minus
        : paymentMethodIcons[transaction.paymentMethod];
  const isInvoicePayment = transaction.categoryName === invoicePaymentCategoryName;
  const categoryLabel =
    transaction.categoryName === internalTransferCategoryName
      ? "Transf. interna"
      : transaction.categoryName;
  const isInvoiceAdjustment = transaction.origin === "invoiceAdjustment";
  const isInvoiceReduction = isInvoiceAdjustment && visibleAmount > 0;
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
  const canDelete = isInvoiceAdjustment || canDeleteTransactionOrigin(transaction.origin);
  const isPaymentControlledByInvoice =
    transaction.paymentMethod === "credit_card" || transaction.isSettled === null;
  const shouldShowPersonContext =
    transaction.allocation !== null ||
    transaction.isDivided ||
    (adminPersonId !== null && transaction.personId !== adminPersonId);
  const showPurchaseDate = transaction.paymentMethod !== "boleto" || accountStatement;
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
        isInvoicePayment
          ? "bg-success/5 hover:bg-success/10"
          : isRefund
            ? "bg-success/5"
            : undefined,
        selected && "bg-brand/5",
        splitConnector && splitConnector !== "end" && "border-b-0",
      )}
    >
      <TableCell>
        <Checkbox
          aria-label={
            selectable
              ? `Selecionar ${transaction.name}`
              : `${transaction.name} não participa da conferência`
          }
          checked={selected}
          className={cn(!selectable && "opacity-40!")}
          disabled={!selectable}
          onCheckedChange={onSelectionChange}
        />
      </TableCell>
      <TransactionRowDescription
        period={period}
        transaction={transaction}
        accountStatement={accountStatement}
        splitConnector={splitConnector}
        onView={onView}
        isLastInstallment={isLastInstallment}
        shouldShowPersonContext={shouldShowPersonContext}
        showPurchaseDate={showPurchaseDate}
        featuredLogo={featuredLogo}
        featuredLogoName={featuredLogoName}
        categoryLabel={categoryLabel}
      />
      <TableCell className="text-right whitespace-nowrap">
        <span className="sr-only">
          {isRefund
            ? "Reembolso"
            : isInvoiceReduction
              ? "Redução de despesa"
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
          showPositiveSign={
            transaction.type === "income" || isIncomingTransfer || isInvoiceReduction
          }
        />
      </TableCell>
      <TableCell className="pl-5 whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <ConditionIcon aria-hidden="true" className="size-4" />
          {transactionConditionLabels[transaction.condition]}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-2">
          <PaymentIcon aria-hidden="true" className="size-4" />
          {formatPaymentMethodTable(transaction.paymentMethod, transaction.origin)}
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
          <TransactionRowActions
            transaction={transaction}
            pending={pending}
            onEdit={onEdit}
            onView={onView}
            onCopy={onCopy}
            onAnticipate={onAnticipate}
            onUndoAnticipation={onUndoAnticipation}
            onRefund={onRefund}
            isBalanceAdjustment={isBalanceAdjustment}
            isGenerated={isGenerated}
            isRefund={isRefund}
            isInvoiceAdjustment={isInvoiceAdjustment}
            canDelete={canDelete}
            setDeleteOpen={setDeleteOpen}
            setInstallmentDeleteOpen={setInstallmentDeleteOpen}
            setRecurringAction={setRecurringAction}
          />
          <TransactionActionDialogs
            transaction={transaction}
            pending={pending}
            onDelete={onDelete}
            onRecurringStatus={onRecurringStatus}
            isBalanceAdjustment={isBalanceAdjustment}
            isRefund={isRefund}
            isInvoiceAdjustment={isInvoiceAdjustment}
            deleteOpen={deleteOpen}
            installmentDeleteOpen={installmentDeleteOpen}
            recurringAction={recurringAction}
            setDeleteOpen={setDeleteOpen}
            setInstallmentDeleteOpen={setInstallmentDeleteOpen}
            setRecurringAction={setRecurringAction}
          />{" "}
        </div>
      </TableCell>
    </TableRow>
  );
}

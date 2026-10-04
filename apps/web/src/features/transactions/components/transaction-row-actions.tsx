import { Copy, Eye, MoreHorizontal, Pause, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TransactionActionsMenu } from "./transaction-actions-menu";
import type { TransactionRowProps } from "./transactions-table.types";
export function TransactionRowActions({
  transaction,
  pending,
  onEdit,
  onView,
  onCopy,
  onAnticipate,
  onUndoAnticipation,
  onRefund,
  isBalanceAdjustment,
  isGenerated,
  isRefund,
  isInvoiceAdjustment,
  canDelete,
  setDeleteOpen,
  setInstallmentDeleteOpen,
  setRecurringAction,
}: {
  transaction: TransactionRowProps["transaction"];
  pending: TransactionRowProps["pending"];
  onEdit: TransactionRowProps["onEdit"];
  onView: TransactionRowProps["onView"];
  onCopy: TransactionRowProps["onCopy"];
  onAnticipate: TransactionRowProps["onAnticipate"];
  onUndoAnticipation: TransactionRowProps["onUndoAnticipation"];
  onRefund: TransactionRowProps["onRefund"];
  isBalanceAdjustment: boolean;
  isGenerated: boolean;
  isRefund: boolean;
  isInvoiceAdjustment: boolean;
  canDelete: boolean;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setInstallmentDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setRecurringAction: Dispatch<SetStateAction<"pause" | "cancel" | null>>;
}) {
  return (
    <TransactionActionsMenu
      transaction={transaction}
      trigger={
        <Button
          aria-label={`Ações de ${transaction.name}`}
          disabled={pending}
          size="icon"
          variant="ghost"
        />
      }
      triggerLabel={<MoreHorizontal aria-hidden="true" />}
      leadingItems={
        <DropdownMenuItem onClick={() => onView(transaction)}>
          <Eye />
          Ver detalhes
        </DropdownMenuItem>
      }
      onUndoAnticipation={onUndoAnticipation}
      onAnticipate={onAnticipate}
      onRefund={onRefund}
    >
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
          <DropdownMenuItem onClick={() => setRecurringAction("pause")}>
            <Pause />
            Pausar recorrência
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setRecurringAction("cancel")} variant="destructive">
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
              : isInvoiceAdjustment
                ? "Remover ajuste de fatura"
                : isBalanceAdjustment
                  ? "Remover ajuste"
                  : "Remover lançamento"}
          </DropdownMenuItem>
        </>
      ) : null}
    </TransactionActionsMenu>
  );
}

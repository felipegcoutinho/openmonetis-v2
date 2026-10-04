import type { Dispatch, SetStateAction } from "react";
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
import { InstallmentActionDialog } from "./installment-action-dialog";
import { RecurringStatusDialog } from "./recurring-status-dialog";
import type { TransactionRowProps } from "./transactions-table.types";
export function TransactionActionDialogs({
  transaction,
  pending,
  onDelete,
  onRecurringStatus,
  isBalanceAdjustment,
  isRefund,
  isInvoiceAdjustment,
  deleteOpen,
  installmentDeleteOpen,
  recurringAction,
  setDeleteOpen,
  setInstallmentDeleteOpen,
  setRecurringAction,
}: {
  transaction: TransactionRowProps["transaction"];
  pending: TransactionRowProps["pending"];
  onDelete: TransactionRowProps["onDelete"];
  onRecurringStatus: TransactionRowProps["onRecurringStatus"];
  isBalanceAdjustment: boolean;
  isRefund: boolean;
  isInvoiceAdjustment: boolean;
  deleteOpen: boolean;
  installmentDeleteOpen: boolean;
  recurringAction: "pause" | "cancel" | null;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setInstallmentDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setRecurringAction: Dispatch<SetStateAction<"pause" | "cancel" | null>>;
}) {
  return (
    <>
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRefund
                ? "Remover reembolso?"
                : isInvoiceAdjustment
                  ? "Remover ajuste de fatura?"
                  : isBalanceAdjustment
                    ? "Remover ajuste de saldo?"
                    : "Remover lançamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRefund
                ? `O reembolso de “${transaction.name.replace(/^Reembolso · /, "")}” será desfeito.`
                : isInvoiceAdjustment
                  ? "O ajuste será removido e o valor da fatura será recalculado. Se houver pagamentos, reabra a fatura primeiro."
                  : isBalanceAdjustment
                    ? "O lançamento de ajuste será removido e o saldo da conta será recalculado."
                    : `O lançamento “${transaction.name}” será removido desta base.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => onDelete(transaction, "single")}
              variant="destructive"
            >
              {isBalanceAdjustment || isInvoiceAdjustment ? "Remover ajuste" : "Remover lançamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <InstallmentActionDialog
        action="delete"
        key={`delete-${transaction.id}`}
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
    </>
  );
}

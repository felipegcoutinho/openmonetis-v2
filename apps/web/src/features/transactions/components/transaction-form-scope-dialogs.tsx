import { toast } from "sonner";

import { getTransactionMutationErrorMessage } from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { InstallmentActionDialog } from "./installment-action-dialog";
import { RecurringEditScopeDialog } from "./recurring-edit-scope-dialog";

import type { TransactionFormProps } from "./transaction-form.types";

export function TransactionFormScopeDialogs({
  pendingInstallmentUpdate,
  setPendingInstallmentUpdate,
  pendingRecurringUpdate,
  setPendingRecurringUpdate,
  persistTransactionUpdate,
  updateTransaction,
  updateRecurringRule,
  transaction,
  onSaved,
}: {
  pendingInstallmentUpdate: ReturnType<typeof useTransactionForm>["pendingInstallmentUpdate"];
  setPendingInstallmentUpdate: ReturnType<typeof useTransactionForm>["setPendingInstallmentUpdate"];
  pendingRecurringUpdate: ReturnType<typeof useTransactionForm>["pendingRecurringUpdate"];
  setPendingRecurringUpdate: ReturnType<typeof useTransactionForm>["setPendingRecurringUpdate"];
  persistTransactionUpdate: ReturnType<typeof useTransactionForm>["persistTransactionUpdate"];
  updateTransaction: ReturnType<typeof useTransactionForm>["updateTransaction"];
  updateRecurringRule: ReturnType<typeof useTransactionForm>["updateRecurringRule"];
  transaction: TransactionFormProps["transaction"];
  onSaved: TransactionFormProps["onSaved"];
}) {
  return (
    <>
      <InstallmentActionDialog
        action="edit"
        key={`edit-${transaction?.id ?? "closed"}`}
        onConfirm={async (scope) => {
          if (!pendingInstallmentUpdate) return;
          try {
            await persistTransactionUpdate(
              pendingInstallmentUpdate.data,
              scope,
              pendingInstallmentUpdate.value,
            );
          } catch (error) {
            toast.error("Não foi possível salvar o lançamento", {
              description: getTransactionMutationErrorMessage(error),
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingInstallmentUpdate(null);
        }}
        open={Boolean(pendingInstallmentUpdate)}
        pending={updateTransaction.isPending}
        transaction={transaction}
      />
      <RecurringEditScopeDialog
        key={`recurring-edit-${transaction?.id ?? "closed"}`}
        onConfirm={async (scope) => {
          if (!pendingRecurringUpdate || !transaction?.recurringRuleId) return;
          try {
            await updateRecurringRule.mutateAsync({
              id: transaction.recurringRuleId,
              data: pendingRecurringUpdate,
              scope,
              occurrenceDate: transaction.purchaseDate,
            });
            setPendingRecurringUpdate(null);
            toast.success("Recorrência atualizada");
            onSaved();
          } catch (error) {
            toast.error("Não foi possível salvar a recorrência", {
              description: getTransactionMutationErrorMessage(error),
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingRecurringUpdate(null);
        }}
        open={Boolean(pendingRecurringUpdate)}
        pending={updateRecurringRule.isPending}
        scheduleChanged={Boolean(
          pendingRecurringUpdate &&
            (pendingRecurringUpdate.purchaseDate !== transaction?.purchaseDate ||
              pendingRecurringUpdate.recurrenceFrequency !== transaction?.recurrenceFrequency),
        )}
      />
    </>
  );
}

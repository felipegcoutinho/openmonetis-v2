import type { TransactionOutput } from "@openmonetis/validators/transactions";
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
import type { TransactionDetailsSheetProps } from "./transaction-details-sheet.types";
export function TransactionDetailsActionDialogs({
  detail,
  mobileActions,
  onOpenChange,
  deleteOpen,
  installmentDeleteOpen,
  recurringAction,
  setDeleteOpen,
  setInstallmentDeleteOpen,
  setRecurringAction,
}: {
  detail: TransactionOutput | null;
  mobileActions: TransactionDetailsSheetProps["mobileActions"];
  onOpenChange: TransactionDetailsSheetProps["onOpenChange"];
  deleteOpen: boolean;
  installmentDeleteOpen: boolean;
  recurringAction: "pause" | "cancel" | null;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setInstallmentDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setRecurringAction: Dispatch<SetStateAction<"pause" | "cancel" | null>>;
}) {
  return (
    <>
      {mobileActions && detail ? (
        <>
          <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  O lançamento “{detail.name}” será removido desta base.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={mobileActions.pendingTransactionId === detail.recordId}
                  onClick={() => {
                    mobileActions.onDelete(detail, "single");
                    onOpenChange(false);
                  }}
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
              await mobileActions.onDelete(detail, scope);
              setInstallmentDeleteOpen(false);
              onOpenChange(false);
            }}
            onOpenChange={setInstallmentDeleteOpen}
            open={installmentDeleteOpen}
            pending={mobileActions.pendingTransactionId === detail.recordId}
            transaction={detail}
          />
          <RecurringStatusDialog
            action={recurringAction}
            name={detail.name}
            onConfirm={(action) =>
              mobileActions.onRecurringStatus(
                detail.recurringRuleId as string,
                action === "pause" ? "paused" : "cancelled",
              )
            }
            onOpenChange={(nextOpen) => {
              if (!nextOpen) setRecurringAction(null);
            }}
          />
        </>
      ) : null}
    </>
  );
}

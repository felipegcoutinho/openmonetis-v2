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
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";

import type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";

export function TransactionSplitRemoveDialog({
  removalOpen,
  setRemovalOpen,
  onChange,
}: {
  removalOpen: ReturnType<typeof useTransactionSplitEditor>["removalOpen"];
  setRemovalOpen: ReturnType<typeof useTransactionSplitEditor>["setRemovalOpen"];
  onChange: TransactionSplitDialogProps["onChange"];
}) {
  return (
    <AlertDialog onOpenChange={setRemovalOpen} open={removalOpen}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remover divisão?</AlertDialogTitle>
          <AlertDialogDescription>
            As partes atribuídas às pessoas serão removidas deste lançamento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onChange([]);
              setRemovalOpen(false);
            }}
            variant="destructive"
          >
            Remover divisão
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

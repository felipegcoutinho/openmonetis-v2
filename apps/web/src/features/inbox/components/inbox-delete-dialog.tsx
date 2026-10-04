import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
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
export function InboxDeleteDialog({
  deleteItem,
  setDeleteItem,
  deleteMutation,
  remove,
}: {
  deleteItem: InboxItemSummaryOutput | null;
  setDeleteItem: Dispatch<SetStateAction<InboxItemSummaryOutput | null>>;
  deleteMutation: { isPending: boolean };
  remove: (item: InboxItemSummaryOutput) => Promise<void>;
}) {
  return (
    <AlertDialog onOpenChange={(open) => !open && setDeleteItem(null)} open={Boolean(deleteItem)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este histórico?</AlertDialogTitle>
          <AlertDialogDescription>
            O pré-lançamento será removido. Um lançamento já confirmado não será excluído.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteItem) void remove(deleteItem);
            }}
            variant="destructive"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

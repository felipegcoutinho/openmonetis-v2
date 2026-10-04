import type { InboxClearableStatus } from "@openmonetis/domain/inbox";
import type { InboxPageOutput } from "@openmonetis/validators/inbox";
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
export function InboxClearDialog({
  clearStatus,
  setClearStatus,
  clearMutation,
  clearAll,
  query,
}: {
  clearStatus: InboxClearableStatus | null;
  setClearStatus: Dispatch<SetStateAction<InboxClearableStatus | null>>;
  clearMutation: { isPending: boolean };
  clearAll: () => Promise<void>;
  query: { data?: InboxPageOutput };
}) {
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open && !clearMutation.isPending) setClearStatus(null);
      }}
      open={Boolean(clearStatus)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir {clearStatus ? (query.data?.counts[clearStatus] ?? 0) : 0}{" "}
            {clearStatus === "processed" ? "processadas" : "descartadas"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Todas as capturas desta aba serão excluídas, inclusive as que não aparecem nos filtros
            atuais. Lançamentos já confirmados serão mantidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={clearMutation.isPending}
            onClick={() => void clearAll()}
            variant="destructive"
          >
            {clearMutation.isPending ? "Excluindo..." : "Excluir tudo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTopmostMobileSurface } from "./mobile-surface";

/** Blocks route and tab changes while a page-level editor has unsaved or in-flight changes. */
export function UnsavedChangesGuard({
  hasChanges,
  isBusy,
  onDiscard,
  busyDescription,
  dirtyDescription,
}: {
  hasChanges: boolean;
  isBusy: boolean;
  onDiscard: () => void;
  busyDescription: string;
  dirtyDescription: string;
}) {
  const mobile = useIsMobile();
  const blocker = useBlocker({
    shouldBlockFn: ({ action }) => {
      const surface = mobile ? getTopmostMobileSurface() : undefined;
      if (action === "BACK" && surface && surface.getAttribute("role") !== "alertdialog") {
        return false;
      }
      return hasChanges || isBusy;
    },
    enableBeforeUnload: hasChanges || isBusy,
    withResolver: true,
  });

  return (
    <AlertDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBusy ? "Aguarde a conclusão" : "Descartar alterações?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBusy ? busyDescription : dirtyDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <Button
            disabled={isBusy}
            type="button"
            variant="destructive"
            onClick={() => {
              onDiscard();
              blocker.proceed?.();
            }}
          >
            Descartar e sair
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

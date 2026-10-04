import { useBlocker } from "@tanstack/react-router";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { getTopmostMobileSurface } from "./mobile-surface";

export function MobilePageFormGuard({
  isDirty,
  isSubmitting,
  canLeave,
}: {
  isDirty: boolean;
  isSubmitting: boolean;
  canLeave?: () => boolean;
}) {
  const mobile = useIsMobile();
  const blocker = useBlocker({
    disabled: !mobile,
    shouldBlockFn: ({ action }) => {
      if (canLeave?.()) return false;
      const surface = mobile ? getTopmostMobileSurface() : undefined;
      if (action === "BACK" && surface && surface.getAttribute("role") !== "alertdialog") {
        return false;
      }
      return isDirty || isSubmitting;
    },
    enableBeforeUnload: () => Boolean(mobile && !canLeave?.() && (isDirty || isSubmitting)),
    withResolver: true,
  });
  return (
    <AlertDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.status === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSubmitting ? "Aguarde o salvamento" : "Descartar alterações?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSubmitting
              ? "Seu formulário está sendo salvo."
              : "As alterações deste formulário ainda não foram salvas."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            onClick={() => {
              if (blocker.status === "blocked") blocker.proceed();
            }}
          >
            Descartar e sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

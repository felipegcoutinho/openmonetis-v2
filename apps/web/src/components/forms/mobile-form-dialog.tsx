import { type ComponentProps, createContext, type RefObject, useRef, useState } from "react";
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
import { Dialog } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";

export const MobileFormDialogContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function MobileFormDialog({
  children,
  onOpenChange,
  ...props
}: ComponentProps<typeof Dialog>) {
  const mobile = useIsMobile();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const pendingClose = useRef<(() => void) | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  return (
    <>
      <MobileFormDialogContext value={popupRef}>
        <Dialog
          {...props}
          onOpenChange={(open, details) => {
            if (mobile && !open) {
              const state = popupRef.current?.querySelector<HTMLElement>(
                "[data-mobile-form-state]",
              );
              if (state?.dataset.submitting === "true") {
                details.cancel();
                return;
              }
              if (state?.dataset.dirty === "true") {
                details.cancel();
                pendingClose.current = () => onOpenChange?.(false, details);
                setDiscardOpen(true);
                return;
              }
            }
            onOpenChange?.(open, details);
          }}
        >
          {children}
        </Dialog>
      </MobileFormDialogContext>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações deste formulário ainda não foram salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const close = pendingClose.current;
                pendingClose.current = null;
                setDiscardOpen(false);
                close?.();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

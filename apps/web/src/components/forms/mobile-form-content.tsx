import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useBlocker } from "@tanstack/react-router";
import { ArrowLeft, XIcon } from "lucide-react";
import { type ComponentProps, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { cn } from "@/lib/utils";
import { MobileFormDialogContext } from "./mobile-form-dialog";
import { getTopmostMobileSurface } from "./mobile-surface";

/** Opt-in mobile presentation; the desktop dialog and form instance stay intact. */
export function MobileFormContent({
  children,
  className,
  showCloseButton = true,
  mobileLayout = "page",
  guarded = false,
  onClickCapture,
  ...props
}: ComponentProps<typeof DialogContent> & { mobileLayout?: "page" | "sheet"; guarded?: boolean }) {
  const mobile = useIsMobile();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const guardedPopupRef = useContext(MobileFormDialogContext);
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      popupRef.current = node;
      if (guarded && guardedPopupRef) guardedPopupRef.current = node;
      setElement(node);
    },
    [guarded, guardedPopupRef],
  );

  useBlocker({
    disabled: !mobile || !element,
    enableBeforeUnload: false,
    shouldBlockFn: ({ action }) => {
      if (action !== "BACK") return false;
      // Close the topmost surface through its own handler (including discard guards).
      if (!element || element.hasAttribute("data-closed")) return false;
      const surface = getTopmostMobileSurface();
      if (!surface) return false;
      surface
        ?.querySelector<HTMLButtonElement>(
          '[data-mobile-back], [data-slot="dialog-close"], [data-slot="sheet-close"], [data-slot="alert-dialog-cancel"]',
        )
        ?.click();
      return true;
    },
  });

  useMobileViewport(element);
  const mobileSheet = Boolean(mobile) && mobileLayout === "sheet";
  useSwipeToDismiss(element, { enabled: mobileSheet && showCloseButton });
  useEffect(() => {
    if (!mobile || !element) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (
        element?.querySelector(
          '[data-mobile-form-state][data-dirty="true"], [data-mobile-form-state][data-submitting="true"]',
        )
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [mobile, element]);

  return (
    <DialogContent
      {...props}
      ref={attach}
      initialFocus={mobile ? () => popupRef.current : props.initialFocus}
      className={cn(className, "mobile-form-content")}
      data-mobile-layout={mobileLayout}
      showCloseButton={showCloseButton && !mobile}
      onClickCapture={(event) => {
        onClickCapture?.(event);
        if (!mobile || !guarded || !guardedPopupRef || event.defaultPrevented) return;
        const target = event.target as HTMLElement;
        if (!target.closest("[data-mobile-cancel]")) return;
        event.preventDefault();
        event.stopPropagation();
        popupRef.current?.querySelector<HTMLButtonElement>("[data-mobile-back]")?.click();
      }}
    >
      {mobileSheet && showCloseButton ? (
        <span aria-hidden="true" className="sheet-grabber" data-slot="sheet-grabber" />
      ) : null}
      {children}
      {mobile && showCloseButton ? (
        // A full-screen form goes back like a page; a bottom sheet closes like one.
        <DialogPrimitive.Close
          data-mobile-back
          className="mobile-form-back"
          render={
            <Button aria-label={mobileSheet ? "Fechar" : "Voltar"} size="icon" variant="ghost" />
          }
        >
          {mobileSheet ? <XIcon aria-hidden="true" /> : <ArrowLeft aria-hidden="true" />}
        </DialogPrimitive.Close>
      ) : null}
    </DialogContent>
  );
}

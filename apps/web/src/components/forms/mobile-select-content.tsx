import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useBlocker } from "@tanstack/react-router";
import { type ComponentProps, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectContent } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { MobileSelectCloseContext } from "./mobile-select";

/** Keeps the desktop select untouched and uses a touch-sized bottom list on mobile. */
export function MobileSelectContent({ children, ...props }: ComponentProps<typeof SelectContent>) {
  const mobile = useIsMobile();
  const select = useContext(MobileSelectCloseContext);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useMobileViewport(element);
  useBlocker({
    disabled: !mobile || !select?.open,
    enableBeforeUnload: false,
    shouldBlockFn: ({ action }) => {
      if (action !== "BACK") return false;
      select?.close();
      return true;
    },
  });
  if (!mobile) return <SelectContent {...props}>{children}</SelectContent>;

  const {
    className: _className,
    side: _side,
    sideOffset: _sideOffset,
    align: _align,
    alignOffset: _alignOffset,
    alignItemWithTrigger: _alignItemWithTrigger,
    ...popupProps
  } = props;
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay" />
      <SelectPrimitive.Positioner
        ref={setElement}
        className="mobile-select-positioner"
        alignItemWithTrigger={false}
        style={{
          position: "fixed",
          inset:
            "auto 0 max(0px, calc(100dvh - var(--form-height, 100dvh) - var(--form-top, 0px)))",
          transform: "none",
          width: "100%",
        }}
      >
        <SelectPrimitive.Popup
          {...popupProps}
          className="mobile-select-content"
          data-mobile-select={select?.open || undefined}
        >
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <span className="text-sm font-medium">Selecione uma opção</span>
            <Button
              data-mobile-back
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => select?.close()}
            >
              Fechar
            </Button>
          </div>
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

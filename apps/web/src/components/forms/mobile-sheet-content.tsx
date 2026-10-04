import { useBlocker } from "@tanstack/react-router";
import { type ComponentProps, useState } from "react";
import { SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { cn } from "@/lib/utils";
import { getTopmostMobileSurface } from "./mobile-surface";

export function MobileSheetContent({
  className,
  mobileLayout = "sheet",
  ...props
}: ComponentProps<typeof SheetContent> & { mobileLayout?: "sheet" | "page" }) {
  const mobile = useIsMobile();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useMobileViewport(element);
  useBlocker({
    disabled: !mobile || !element,
    enableBeforeUnload: false,
    shouldBlockFn: ({ action }) => {
      if (action !== "BACK") return false;
      if (!element || element.hasAttribute("data-ending-style")) return false;
      const surface = getTopmostMobileSurface();
      if (!surface) return false;
      surface
        ?.querySelector<HTMLButtonElement>(
          '[data-mobile-back], [data-slot="sheet-close"], [data-slot="dialog-close"], [data-slot="alert-dialog-cancel"]',
        )
        ?.click();
      return true;
    },
  });

  return (
    <SheetContent
      {...props}
      ref={setElement}
      side={mobile ? "bottom" : props.side}
      className={cn(className, "mobile-sheet-content")}
      data-mobile-layout={mobileLayout}
    />
  );
}

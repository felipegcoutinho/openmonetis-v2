import { type ComponentProps, createContext, type ReactNode, useContext } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileSheetContent } from "./mobile-sheet-content";

const MobilePickerContext = createContext(false);

export function MobilePicker({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const mobile = useIsMobile();
  return (
    <MobilePickerContext value={Boolean(mobile)}>
      {mobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={onOpenChange}>
          {children}
        </Popover>
      )}
    </MobilePickerContext>
  );
}

export function MobilePickerTrigger(props: ComponentProps<typeof PopoverTrigger>) {
  const mobile = useContext(MobilePickerContext);
  const {
    handle: _handle,
    openOnHover: _hover,
    delay: _delay,
    closeDelay: _closeDelay,
    ...sheetProps
  } = props;
  return mobile ? <SheetTrigger {...sheetProps} /> : <PopoverTrigger {...props} />;
}

export function MobilePickerContent({
  title = "Selecione uma opção",
  children,
  ...props
}: ComponentProps<typeof PopoverContent> & { title?: string }) {
  const mobile = useContext(MobilePickerContext);
  if (!mobile) return <PopoverContent {...props}>{children}</PopoverContent>;

  return (
    <MobileSheetContent aria-describedby={undefined}>
      <SheetHeader className="border-b pr-16">
        <SheetTitle>{title}</SheetTitle>
      </SheetHeader>
      <div className="mobile-picker-body min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
    </MobileSheetContent>
  );
}

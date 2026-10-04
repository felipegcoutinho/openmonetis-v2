import { Select as SelectPrimitive } from "@base-ui/react/select";
import { createContext, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

export const MobileSelectCloseContext = createContext<{ open: boolean; close: () => void } | null>(
  null,
);

export function MobileSelect<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <MobileSelectCloseContext value={{ open: props.open ?? open, close: () => setOpen(false) }}>
      <SelectPrimitive.Root
        {...props}
        {...(mobile && props.open === undefined
          ? {
              open,
              onOpenChange: (nextOpen, details) => {
                props.onOpenChange?.(nextOpen, details);
                if (!details.isCanceled) setOpen(nextOpen);
              },
            }
          : {})}
      />
    </MobileSelectCloseContext>
  );
}

import { Info } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type InfoTipProps = {
  /** Accessible name of the trigger, e.g. "Como a média é calculada". */
  label?: string;
  children: ReactNode;
  /** Custom trigger element; defaults to a small info icon with a 44px hit area. */
  render?: ReactElement;
  /** Visible content of the default trigger or of `render`. */
  trigger?: ReactNode;
  className?: string;
  contentClassName?: string;
} & Pick<ComponentProps<typeof PopoverContent>, "align" | "side">;

/**
 * Toggletip for explanations: opens on hover with a mouse and on tap with a finger, so the text
 * a tooltip would hide is also reachable on phones and by keyboard.
 */
export function InfoTip({
  align = "center",
  children,
  className,
  contentClassName,
  label,
  render,
  side = "top",
  trigger,
}: InfoTipProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className={
          render
            ? className
            : cn(
                "relative inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground outline-none after:absolute after:-inset-3.5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                className,
              )
        }
        closeDelay={100}
        delay={150}
        openOnHover
        render={render}
      >
        {trigger ?? <Info aria-hidden="true" className="size-3.5" />}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-auto max-w-72 gap-2 p-3 text-pretty text-sm", contentClassName)}
        side={side}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

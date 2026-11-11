import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Small inline trigger that reveals a free-text note. A popover (not a tooltip) so it also opens
 * on tap and keeps a 34px hit area around the 14px icon.
 */
export function NotePopover({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="relative grid size-3.5 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none after:absolute after:-inset-2.5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {icon}
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm whitespace-pre-line wrap-break-word">
        {children}
      </PopoverContent>
    </Popover>
  );
}

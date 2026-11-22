import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Icon of a tab bar item: a pill marks the active tab and shrinks under the finger. */
export function MobileNavigationIcon({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid h-9 w-15 place-items-center rounded-full transition-[background-color,scale] duration-(--duration-fast) ease-(--ease-out-strong) group-active/nav-item:scale-90 group-active/nav-item:bg-(--pressed) motion-reduce:transition-none",
        active && "bg-brand/14",
      )}
    >
      {children}
    </span>
  );
}

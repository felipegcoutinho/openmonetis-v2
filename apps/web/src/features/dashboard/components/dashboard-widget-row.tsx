import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type DashboardWidgetRowProps = ComponentProps<"li"> & {
  structure?: "details" | "progress";
};

export function DashboardWidgetRow({
  className,
  structure = "details",
  ...props
}: DashboardWidgetRowProps) {
  return (
    <li
      className={cn(
        "flex items-center gap-3",
        structure === "details" ? "h-16" : "h-20 py-2",
        className,
      )}
      {...props}
    />
  );
}

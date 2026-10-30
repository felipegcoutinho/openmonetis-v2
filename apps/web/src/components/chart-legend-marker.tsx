import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartLegendMarkerProps = {
  /** Any CSS color, usually a chart token such as `var(--chart-1)`. */
  color?: string;
  /** Tailwind text color class, for markers tied to a semantic token such as `text-success`. */
  className?: string;
  /** `line` marks a line series (e.g. cumulative values); `area` marks bars and slices. */
  variant?: "area" | "line";
};

export function ChartLegendMarker({ color, className, variant = "area" }: ChartLegendMarkerProps) {
  if (variant === "line") {
    return (
      <span
        aria-hidden="true"
        className={cn("h-0.5 w-3 shrink-0 bg-current", className)}
        style={color ? { color } : undefined}
      />
    );
  }

  return (
    <CircleDashed
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      strokeWidth={2.5}
      style={color ? { color } : undefined}
    />
  );
}

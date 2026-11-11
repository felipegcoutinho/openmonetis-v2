import { Squircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartLegendMarkerProps = {
  /** Any CSS color, usually a chart token such as `var(--chart-1)`. */
  color?: string;
  /** Tailwind text color class, for markers tied to a semantic token such as `text-success`. */
  className?: string;
  /**
   * `line` marks a line series (e.g. cumulative values), `dashed` a reference series drawn with a
   * dashed stroke, and `area` marks bars and slices.
   */
  variant?: "area" | "dashed" | "line";
};

export function ChartLegendMarker({ color, className, variant = "area" }: ChartLegendMarkerProps) {
  if (variant === "dashed") {
    return (
      <span
        aria-hidden="true"
        className={cn("h-0 w-3 shrink-0 border-current border-t-2 border-dashed", className)}
        style={color ? { color } : undefined}
      />
    );
  }

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
    <Squircle
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      fill="currentColor"
      // Fill only: a stroke over the fill doubles the alpha of translucent colors into a border.
      strokeWidth={0}
      style={color ? { color } : undefined}
    />
  );
}

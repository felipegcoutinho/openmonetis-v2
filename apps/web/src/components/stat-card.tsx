import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared typography for headline figures, also used by the metric tiles of `FinancialSummaryHeader`. */
export const statLabelClassName =
  "flex min-w-0 items-center gap-2 font-heading font-medium text-base leading-normal [&_svg]:size-4 [&_svg]:shrink-0";
export const statValueClassName = "min-w-0 font-medium text-xl tabular-nums leading-tight";

type StatCardProps = {
  /** Supporting content rendered below the value, such as a gauge. */
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  /** What the value refers to (e.g. a category), rendered between label and value. */
  subject?: ReactNode;
  value: ReactNode;
  valueClassName?: string;
};

/** Headline figure for report summaries: icon + label, value and an optional short context. */
export function StatCard({
  children,
  className,
  description,
  icon,
  label,
  subject,
  value,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className={cn("min-w-0 gap-1 px-5 py-4", className)}>
      <p className={statLabelClassName}>
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </p>
      {subject ? (
        <div className="min-w-0 py-1 font-medium text-sm leading-snug">{subject}</div>
      ) : null}
      <div className={cn(statValueClassName, valueClassName)}>{value}</div>
      {children}
      {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
    </Card>
  );
}

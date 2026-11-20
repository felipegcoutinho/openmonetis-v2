import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Compact figure typography for the metric tiles of `FinancialSummaryHeader` and the budgets summary. */
export const statLabelClassName =
  "flex min-w-0 items-center gap-2 font-heading font-medium text-base leading-normal [&_svg]:size-4 [&_svg]:shrink-0";
export const statValueClassName = "min-w-0 font-medium text-xl tabular-nums leading-tight";

type StatCardProps = {
  /** Optional control aligned with the label, such as a link to the underlying records. */
  action?: ReactNode;
  /** Short context right below the label (e.g. "Entradas do mês, com previstas"). */
  caption?: ReactNode;
  /** Supporting content rendered below the value, such as a gauge or a comparison. */
  children?: ReactNode;
  className?: string;
  /** Footnote below the value, such as a comparison with the previous period. */
  description?: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  /** What the value refers to (e.g. a category), rendered between label and value. */
  subject?: ReactNode;
  value: ReactNode;
  valueClassName?: string;
};

/**
 * Headline figure shared by the overview and the reports: muted icon + label, optional caption,
 * a large tabular value and optional supporting content below it.
 */
export function StatCard({
  action,
  caption,
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
    <Card className={cn("min-w-0 gap-4 px-5 py-5", className)}>
      <div className="grid min-w-0 gap-1">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 font-medium text-muted-foreground text-sm [&_svg]:size-4 [&_svg]:shrink-0">
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            {typeof label === "string" ? (
              <span className="min-w-0 truncate">{label}</span>
            ) : (
              <span className="flex min-w-0 items-center gap-2">{label}</span>
            )}
          </p>
          {action}
        </div>
        {caption ? <p className="truncate text-muted-foreground text-xs">{caption}</p> : null}
      </div>
      {subject ? <div className="min-w-0 font-medium text-sm leading-snug">{subject}</div> : null}
      <div className="mt-auto grid min-w-0 gap-3">
        <div className={cn("kpi-value min-w-0 text-2xl md:text-[1.875rem]", valueClassName)}>
          {value}
        </div>
        {children}
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
    </Card>
  );
}

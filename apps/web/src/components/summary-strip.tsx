import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SummaryStripItem = {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
};

/** One-line summary for work screens, where the list below is the main content. */
export function SummaryStrip({
  details,
  items,
  label,
}: {
  details?: ReactNode;
  items: SummaryStripItem[];
  label: string;
}) {
  return (
    <Card aria-label={label} className="gap-0 border py-0" role="region">
      <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        {items.map((item) => (
          <div className="grid min-w-0 gap-0.5" key={item.label}>
            <dt className="text-muted-foreground text-xs">{item.label}</dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                item.emphasized ? "font-heading text-2xl" : "text-base",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {details ? <div className="border-t">{details}</div> : null}
    </Card>
  );
}

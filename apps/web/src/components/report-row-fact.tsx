import type { ReactNode } from "react";

/** Label-over-value cell used by report list rows, so every column reads the same way. */
export function ReportRowFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 font-medium tabular-nums">{children}</div>
    </div>
  );
}

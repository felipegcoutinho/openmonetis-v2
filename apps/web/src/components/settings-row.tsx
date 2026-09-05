import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function SettingsRow({
  children,
  description,
  id,
  label,
}: {
  children: ReactNode;
  description: string;
  id: string;
  label: string;
}) {
  return (
    <div className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <Label className="font-sans text-sm tracking-normal" htmlFor={id}>
          {label}
        </Label>
        <p className="mt-1 text-muted-foreground text-sm leading-relaxed" id={`${id}-description`}>
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

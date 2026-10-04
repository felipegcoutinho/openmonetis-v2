import type { LucideIcon } from "lucide-react";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { cn } from "@/lib/utils";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    icon?: LucideIcon;
    dotClassName?: string;
  }>;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="grid min-w-0 gap-2">
      <span className="font-medium text-muted-foreground text-xs">{label}</span>
      <Select onValueChange={(next) => next && onChange(next)} value={value}>
        <SelectTrigger className="w-full min-w-0 overflow-hidden">
          <SelectValue
            className={cn("min-w-0", value === "all" ? "text-muted-foreground" : "text-foreground")}
          >
            {selectedOption ? <FilterSelectOption option={selectedOption} /> : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} className="min-w-56">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <FilterSelectOption option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterSelectOption({
  option,
}: {
  option: { label: string; icon?: LucideIcon; dotClassName?: string };
}) {
  const Icon = option.icon;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.dotClassName ? (
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", option.dotClassName)}
        />
      ) : null}
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

import { Info } from "lucide-react";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { daysOfMonth } from "../cards.presentation";

export function DayField({
  fieldId,
  help,
  label,
  onChange,
  value,
}: {
  fieldId: string;
  help?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        {help ? (
          <Tooltip>
            <TooltipTrigger
              aria-label="Informações sobre o ajuste do vencimento"
              render={
                <button
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  type="button"
                />
              }
            >
              <Info aria-hidden="true" className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{help}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <Select
        onValueChange={(day) => {
          if (day) onChange(day);
        }}
        value={value}
      >
        <SelectTrigger className="w-full" id={fieldId}>
          <SelectValue>Dia {value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {daysOfMonth.map((day) => (
            <SelectItem key={day} value={String(day)}>
              Dia {day}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

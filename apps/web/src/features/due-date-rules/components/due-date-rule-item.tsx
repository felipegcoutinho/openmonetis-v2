import type { DueDateRule } from "@openmonetis/domain/due-date-rules";
import { type DueDateRuleOptions, DueDateRuleSchema } from "@openmonetis/validators/due-date-rules";
import { Trash2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dueDateRuleSelectionSummary, dueDateRuleSummary } from "../due-date-rules.presentation";
import { DueDateRuleFields } from "./due-date-rule-fields";

export function DueDateRuleItem({
  rule,
  options,
  disabled,
  conflicting,
  onChange,
  onRemove,
}: {
  rule: DueDateRule;
  options: DueDateRuleOptions;
  disabled: boolean;
  conflicting: boolean;
  onChange: (rule: DueDateRule) => void;
  onRemove: () => void;
}) {
  const name = rule.name.trim() || "Nova regra";
  const incomplete = !DueDateRuleSchema.safeParse(rule).success;

  return (
    <AccordionItem
      className="rounded-lg border border-border not-last:border-b data-open:bg-muted/20"
      value={rule.id}
    >
      <div className="flex items-start gap-2 pr-2">
        <AccordionTrigger className="min-w-0 items-center gap-3 px-4 py-3 hover:no-underline">
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium">{name}</span>
              {conflicting ? <Badge variant="destructive">Conflito</Badge> : null}
              {incomplete && !conflicting ? <Badge variant="outline">Incompleta</Badge> : null}
            </span>
            <span className="font-normal text-muted-foreground text-xs">
              {dueDateRuleSummary(rule)}
              {rule.scope === "selected" ? ` · ${dueDateRuleSelectionSummary(rule)}` : ""}
            </span>
          </span>
        </AccordionTrigger>
        <Button
          aria-label={`Remover regra ${name}`}
          className="mt-2 shrink-0 text-muted-foreground hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
      <AccordionContent className="grid gap-3 px-4 pt-1 pb-4">
        {conflicting ? (
          <p className="text-destructive text-sm" role="alert">
            Outra regra abrange os mesmos itens. Ajuste a abrangência de uma delas.
          </p>
        ) : null}
        <DueDateRuleFields disabled={disabled} onChange={onChange} options={options} rule={rule} />
      </AccordionContent>
    </AccordionItem>
  );
}

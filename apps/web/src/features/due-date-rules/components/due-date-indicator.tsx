import type {
  DueDateAdjustmentDetails,
  SetDueDateExceptionInput,
} from "@openmonetis/validators/due-date-rules";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarClock, Settings2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSetDueDateExceptionMutation } from "../due-date-rules.mutations";
import {
  dueDateRulesErrorMessage,
  formatDueDate,
  formatDueDateAdjustmentReasons,
  formatDueDateChange,
} from "../due-date-rules.presentation";

type ExceptionTarget = SetDueDateExceptionInput extends infer T
  ? T extends SetDueDateExceptionInput
    ? Omit<T, "excluded">
    : never
  : never;
export function DueDateIndicator({
  dueDate,
  originalDueDate,
  adjustment,
  excluded = false,
  target,
  editable = false,
  children,
  className,
}: {
  dueDate: string;
  originalDueDate?: string | null;
  adjustment?: DueDateAdjustmentDetails | null;
  excluded?: boolean;
  target?: ExceptionTarget;
  editable?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useSetDueDateExceptionMutation();
  const adjusted = Boolean(originalDueDate && originalDueDate !== dueDate);
  if (!adjusted && !excluded)
    return <span className={className}>{children ?? formatDueDate(dueDate)}</span>;
  const title = excluded ? "Data original mantida" : "Vencimento ajustado";
  const explanation = adjustment ? formatDueDateAdjustmentReasons(adjustment) : null;
  const description = excluded
    ? "Ajuste automático desativado para este item."
    : (explanation ?? "Data preservada.");
  const dateChange = formatDueDateChange(originalDueDate ?? dueDate, dueDate);
  const tooltip = excluded
    ? `${formatDueDate(dueDate)} · data original`
    : `${dateChange} · ${adjustment?.direction === "previous" ? "dia útil anterior" : "próximo dia útil"}`;
  async function toggleException() {
    if (!target || !editable) return;
    try {
      await mutation.mutateAsync({ ...target, excluded: !excluded });
      setOpen(false);
      toast.success(excluded ? "Ajuste automático reativado" : "Vencimento original restaurado");
    } catch (error) {
      toast.error(dueDateRulesErrorMessage(error));
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger delay={250} render={<span className="inline-flex" />}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium text-brand-strong underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  className,
                )}
                aria-label={`${title}: ${formatDueDate(dueDate)}. ${description}`}
              />
            }
          >
            {children ?? formatDueDate(dueDate)}
            {excluded ? (
              <CalendarCheck aria-hidden="true" className="size-3 shrink-0" />
            ) : (
              <CalendarClock aria-hidden="true" className="size-3 shrink-0" />
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 font-normal">{tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="max-h-[var(--available-height)] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto"
      >
        <div className="grid gap-1">
          <h3 className="font-medium text-sm">{title}</h3>
          <p className="text-sm tabular-nums">
            <span className="sr-only">
              Original: {formatDueDate(originalDueDate ?? dueDate)}. Atual: {formatDueDate(dueDate)}
              .
            </span>
            <span aria-hidden="true">{excluded ? formatDueDate(dueDate) : dateChange}</span>
          </p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        {editable && target ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => void toggleException()}
            >
              {mutation.isPending
                ? "Aplicando…"
                : excluded
                  ? "Voltar ao ajuste automático"
                  : "Usar vencimento original"}
            </Button>
            <p className="text-muted-foreground text-xs">
              {target.target === "recurring"
                ? "Só esta ocorrência."
                : target.target === "invoice"
                  ? "Só esta fatura."
                  : "Só este lançamento."}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Data preservada após pagamento ou personalização.
          </p>
        )}
        <Link
          className="flex items-center gap-1.5 border-t pt-3 font-medium text-brand-strong text-xs hover:underline"
          search={{ tab: "due-date-rules" }}
          to="/settings"
        >
          <Settings2 aria-hidden="true" className="size-3.5" />
          Gerenciar regras de vencimento
        </Link>
      </PopoverContent>
    </Popover>
  );
}

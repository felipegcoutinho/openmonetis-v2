import type { TransactionActionScope } from "@openmonetis/validators/transactions";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RecurringEditScopeDialogProps = {
  open: boolean;
  pending: boolean;
  scheduleChanged: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: TransactionActionScope) => void | Promise<void>;
};

export function RecurringEditScopeDialog({
  open,
  pending,
  scheduleChanged,
  onOpenChange,
  onConfirm,
}: RecurringEditScopeDialogProps) {
  const [scope, setScope] = useState<TransactionActionScope>(scheduleChanged ? "series" : "future");
  const options: Array<{
    scope: TransactionActionScope;
    title: string;
    description: string;
  }> = [
    {
      scope: "single",
      title: "Apenas esta ocorrência",
      description: "As demais datas mantêm os dados anteriores.",
    },
    {
      scope: "future",
      title: "Esta e as próximas",
      description: "As ocorrências anteriores mantêm os dados anteriores.",
    },
    {
      scope: "series",
      title: "Todas as ocorrências",
      description: "Inclui as ocorrências calculadas em meses anteriores.",
    },
  ];
  const selectedScope = scheduleChanged ? "series" : scope;

  return (
    <Dialog onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)} open={open}>
      <DialogContent mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar recorrência</DialogTitle>
          <DialogDescription>Escolha quais ocorrências receberão esta alteração.</DialogDescription>
        </DialogHeader>
        {scheduleChanged ? (
          <p className="text-muted-foreground text-sm">
            Alterações na data ou frequência mudam o calendário da recorrência e só podem ser
            aplicadas a todas as ocorrências.
          </p>
        ) : null}
        <div aria-label="Escolha o alcance da edição" className="grid gap-2" role="radiogroup">
          {options.map((option) => {
            const selected = option.scope === selectedScope;
            const disabled = pending || (scheduleChanged && option.scope !== "series");
            const Icon = selected ? CheckCircle2 : Circle;
            return (
              <label
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand-strong/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-brand-strong bg-brand/5",
                  disabled && "cursor-not-allowed opacity-50",
                )}
                key={option.scope}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={disabled}
                  name="recurring-edit-scope"
                  onChange={() => setScope(option.scope)}
                  type="radio"
                  value={option.scope}
                />
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    selected ? "text-brand-strong" : "text-muted-foreground",
                  )}
                />
                <span className="grid gap-0.5">
                  <span className="font-medium text-sm">{option.title}</span>
                  <span className="text-muted-foreground text-xs">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="grid grid-cols-2 [&>*]:w-full">
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button disabled={pending} onClick={() => void onConfirm(selectedScope)} type="button">
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

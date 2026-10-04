import type {
  TransactionActionScope,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
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

type InstallmentActionDialogProps = {
  action: "edit" | "delete";
  open: boolean;
  pending?: boolean;
  transaction: TransactionOutput | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: TransactionActionScope) => void | Promise<void>;
};

export function InstallmentActionDialog({
  action,
  open,
  pending = false,
  transaction,
  onOpenChange,
  onConfirm,
}: InstallmentActionDialogProps) {
  const [scope, setScope] = useState<TransactionActionScope>("single");
  const current = transaction?.currentInstallment ?? 1;
  const total = transaction?.installmentCount ?? current;
  const remaining = Math.max(1, total - current + 1);
  const verb = action === "edit" ? "editar" : "remover";
  const options: Array<{
    scope: TransactionActionScope;
    title: string;
    description: string;
  }> = [
    {
      scope: "single",
      title: `Apenas esta parcela (${current}/${total})`,
      description: `A ação será aplicada somente a este lançamento.`,
    },
    {
      scope: "future",
      title: `Esta e as próximas parcelas (${remaining} ${remaining === 1 ? "parcela" : "parcelas"})`,
      description: `A ação será aplicada desta parcela em diante.`,
    },
    {
      scope: "series",
      title: `Todas as parcelas (${total} parcelas)`,
      description: `A ação será aplicada a todo o parcelamento.`,
    },
  ];

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "edit" ? "Editar parcelamento" : "Remover parcelamento"}
          </DialogTitle>
          <DialogDescription>
            Este lançamento faz parte de um parcelamento ({current}/{total}). Escolha o que deseja
            {` ${verb}`}.
          </DialogDescription>
        </DialogHeader>

        <div aria-label={`Escolha o alcance para ${verb}`} className="grid gap-2" role="radiogroup">
          {options.map((option) => {
            const selected = option.scope === scope;
            const Icon = selected ? CheckCircle2 : Circle;

            return (
              <label
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand-strong/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-brand-strong bg-brand/5",
                  pending && "cursor-not-allowed opacity-60",
                )}
                key={option.scope}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={pending}
                  name="installment-action-scope"
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

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-2 [&>*]:w-full">
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() => void onConfirm(scope)}
            type="button"
            variant={action === "delete" ? "destructive" : "default"}
          >
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

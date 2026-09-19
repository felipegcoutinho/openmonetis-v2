import type { InstallmentGroupOutput } from "@openmonetis/validators/installments";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDashed, CreditCard } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import {
  formatInstallmentDate,
  formatInstallmentPeriod,
  installmentPaymentMethodLabels,
} from "../installments.presentation";

type InstallmentDetailsDialogProps = {
  group: InstallmentGroupOutput;
  onOpenChange: (open: boolean) => void;
  onToggleInstallment: (installmentId: string) => void;
  open: boolean;
  selectedIds: ReadonlySet<string>;
};

export function InstallmentDetailsDialog({
  group,
  onOpenChange,
  onToggleInstallment,
  open,
  selectedIds,
}: InstallmentDetailsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <CategoryIcon name={group.categoryIcon} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{group.name}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5">
                <CreditCard aria-hidden="true" className="size-3.5" />
                {group.cardName ??
                  group.accountName ??
                  installmentPaymentMethodLabels[group.paymentMethod]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
          <Metric label="Compra original" value={group.originalAmount} />
          <Metric label="Valor registrado" value={group.trackedAmount} />
          <Metric label="Saldo pendente" value={group.pendingAmount} />
        </div>

        {group.missingInstallmentCount > 0 ? (
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              {group.missingInstallmentCount}{" "}
              {group.missingInstallmentCount === 1
                ? "parcela acompanhada não está"
                : "parcelas registradas não estão"}{" "}
              no cronograma. Revise a série antes de confiar no saldo.
            </p>
          </div>
        ) : null}

        <div className="grid max-h-[45svh] gap-2 overflow-y-auto pr-1">
          {group.installments.map((installment) => {
            const paid = installment.status === "paid";
            const selected = selectedIds.has(installment.id);
            return (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  paid ? "bg-success/5" : "cursor-pointer hover:bg-muted/50",
                  selected && "border-brand-strong/40 bg-brand/5",
                )}
                key={installment.id}
              >
                {paid ? (
                  <CheckCircle2 aria-label="Paga" className="size-5 shrink-0 text-success" />
                ) : (
                  <Checkbox
                    aria-label={[
                      "Selecionar parcela",
                      installment.installmentNumber,
                      "de",
                      group.totalInstallments,
                    ].join(" ")}
                    checked={selected}
                    onCheckedChange={() => onToggleInstallment(installment.id)}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">
                      Parcela {installment.installmentNumber}/{group.totalInstallments}
                    </span>
                    {installment.isDueInReferencePeriod ? (
                      <Badge variant="secondary">Neste mês</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                    {installment.dueDate ? (
                      <>
                        <CalendarDays aria-hidden="true" className="size-3" />
                        Vencimento em {formatInstallmentDate(installment.dueDate)}
                      </>
                    ) : (
                      <>
                        <CircleDashed aria-hidden="true" className="size-3" />
                        {formatInstallmentPeriod(installment.period)} · sem vencimento informado
                      </>
                    )}
                  </p>
                </div>
                <MoneyValue
                  amount={installment.amount}
                  className={cn("shrink-0 font-medium", paid && "text-success")}
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <MoneyValue amount={value} className="mt-1 font-semibold" />
    </div>
  );
}

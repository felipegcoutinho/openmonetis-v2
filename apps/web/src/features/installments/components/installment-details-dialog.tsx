import type { InstallmentGroupOutput } from "@openmonetis/validators/installments";
import { AlertTriangle, CalendarDays, Check, CircleDashed, Clock, CreditCard } from "lucide-react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  formatInstallmentDate,
  installmentPaymentMethodLabels,
  payoffCheckboxClassName,
} from "../installments.presentation";

type InstallmentDetailsDialogProps = {
  group: InstallmentGroupOutput;
  onOpenChange: (open: boolean) => void;
  onToggleInstallment: (installmentId: string) => void;
  open: boolean;
  /** Pending installments get checkboxes only while a payoff is being simulated. */
  selectable: boolean;
  selectedIds: ReadonlySet<string>;
};

export function InstallmentDetailsDialog({
  group,
  onOpenChange,
  onToggleInstallment,
  open,
  selectable,
  selectedIds,
}: InstallmentDetailsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-mobile-details className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <CategoryIcon name={group.categoryIcon} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate max-md:whitespace-normal max-md:overflow-visible">
                {group.name}
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-1.5">
                <CreditCard aria-hidden="true" className="size-3.5" />
                {group.cardName ??
                  group.accountName ??
                  installmentPaymentMethodLabels[group.paymentMethod]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="contents" data-mobile-detail-body>
          <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
            <Metric label="Valor da compra" value={group.originalAmount} />
            <Metric label="Já pago" value={group.paidAmount} />
            <Metric label="A pagar" value={group.pendingAmount} />
          </div>

          {group.untrackedInstallmentCount > 0 ? (
            <p className="text-muted-foreground text-sm">
              Acompanhada desde a parcela {group.trackedFromInstallment}/{group.totalInstallments}.
              As anteriores não entram nos valores acima.
            </p>
          ) : null}

          {group.missingInstallmentCount > 0 ? (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                {group.missingInstallmentCount}{" "}
                {group.missingInstallmentCount === 1 ? "parcela não está" : "parcelas não estão"} no
                cronograma, então o valor a pagar pode estar menor. Revise a compra.
              </p>
            </div>
          ) : null}

          <div data-mobile-detail-list className="grid max-h-[45svh] gap-2 overflow-y-auto pr-1">
            {group.installments.map((installment) => {
              const paid = installment.status === "paid";
              const selected = selectedIds.has(installment.id);
              return (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    paid && "bg-success/5",
                    selected && "border-teal/40 bg-teal/5",
                  )}
                  key={installment.id}
                >
                  {/* Status is a filled tile, never an outlined circle, so it does not read as a control. */}
                  {selectable && !paid ? (
                    <span className="grid size-8 shrink-0 place-items-center">
                      <Checkbox
                        aria-label={[
                          "Selecionar parcela",
                          installment.installmentNumber,
                          "de",
                          group.totalInstallments,
                        ].join(" ")}
                        checked={selected}
                        className={payoffCheckboxClassName}
                        onCheckedChange={() => onToggleInstallment(installment.id)}
                      />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-md",
                        paid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {paid ? (
                        <Check className="size-4 animate-status-confirm" />
                      ) : (
                        <Clock className="size-4" />
                      )}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">
                        Parcela{" "}
                        <span className="font-mono">
                          {installment.installmentNumber}/{group.totalInstallments}
                        </span>
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
                          {formatPeriod(installment.period)} · sem vencimento informado
                        </>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <MoneyValue
                      amount={installment.amount}
                      className={cn("block font-medium text-sm", paid && "text-success")}
                    />
                    <span
                      className={cn("text-xs", paid ? "text-success" : "text-muted-foreground")}
                    >
                      {paid ? "Paga" : "A pagar"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-muted-foreground text-xs">{label}</p>
      <MoneyValue amount={value} className="kpi-value mt-1" />
    </div>
  );
}

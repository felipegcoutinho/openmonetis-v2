import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUndoInstallmentAnticipationMutation } from "../installments.mutations";
import { formatInstallmentPeriod } from "../installments.presentation";
import { installmentAnticipationQueryOptions } from "../installments.queries";

export function InstallmentAnticipationUndoDialog({
  onOpenChange,
  open,
  transaction,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  transaction: TransactionOutput | null;
}) {
  const id = useId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const seriesId = transaction?.seriesId ?? "";
  const anticipationId = transaction?.anticipationId ?? "";
  const detailsQuery = useQuery({
    ...installmentAnticipationQueryOptions(seriesId, anticipationId),
    enabled: open && Boolean(seriesId && anticipationId),
  });
  const mutation = useUndoInstallmentAnticipationMutation();
  const installments = detailsQuery.data?.installments ?? [];
  const installmentIds = installments
    .filter((installment) => selectedIds.has(installment.id))
    .map((installment) => installment.id);

  async function undoAnticipation() {
    if (!seriesId || !anticipationId || installmentIds.length === 0) return;

    try {
      const result = await mutation.mutateAsync({
        seriesId,
        anticipationId,
        input: { installmentIds },
      });
      toast.success(
        result.remainingInstallmentCount === 0 ? "Antecipação desfeita" : "Parcelas restauradas",
        {
          description:
            result.remainingInstallmentCount === 0
              ? `${result.restoredInstallmentCount} ${result.restoredInstallmentCount === 1 ? "parcela voltou" : "parcelas voltaram"} às faturas originais.`
              : `${result.restoredInstallmentCount} ${result.restoredInstallmentCount === 1 ? "parcela voltou" : "parcelas voltaram"}; ${result.remainingInstallmentCount} continuam antecipadas.`,
        },
      );
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível desfazer a antecipação", {
        description: "A seleção pode ter mudado ou a fatura antecipada já foi paga.",
      });
    }
  }

  return (
    <Dialog onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} open={open}>
      <DialogContent guarded className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-xl">
        <MobileFormState isDirty={selectedIds.size > 0} isSubmitting={mutation.isPending} />
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-brand/10 text-brand-strong">
            <RotateCcw aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle>Quais parcelas deseja restaurar?</DialogTitle>
          <DialogDescription>
            Escolha as parcelas de “{transaction?.name ?? "esta compra"}” que devem voltar às
            faturas originais.
          </DialogDescription>
        </DialogHeader>

        {detailsQuery.isLoading ? (
          <div className="grid gap-2" role="status">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <span className="sr-only">Carregando parcelas antecipadas…</span>
          </div>
        ) : detailsQuery.isError || !detailsQuery.data ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Não foi possível carregar as parcelas.</p>
            <p className="mt-1 text-muted-foreground">Atualize os lançamentos e tente novamente.</p>
          </div>
        ) : (
          <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
            <section className="grid gap-2" aria-labelledby={`${id}-undo-installments-title`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-sm" id={`${id}-undo-installments-title`}>
                    Parcelas antecipadas
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {installmentIds.length} de {installments.length} selecionadas
                  </p>
                </div>
                <Button
                  onClick={() =>
                    setSelectedIds(
                      installmentIds.length === installments.length
                        ? new Set()
                        : new Set(installments.map((installment) => installment.id)),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {installmentIds.length === installments.length
                    ? "Limpar seleção"
                    : "Selecionar todas"}
                </Button>
              </div>

              <div className="grid max-h-[40svh] gap-2 overflow-y-auto pr-1">
                {installments.map((installment) => {
                  const selected = selectedIds.has(installment.id);
                  const checkboxId = `${id}-${installment.id}`;
                  return (
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                        selected && "border-brand-strong/40 bg-brand/5",
                      )}
                      key={installment.id}
                    >
                      <Checkbox
                        checked={selected}
                        id={checkboxId}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(installment.id);
                            else next.delete(installment.id);
                            return next;
                          });
                        }}
                      />
                      <Label className="min-w-0 flex-1 cursor-pointer" htmlFor={checkboxId}>
                        <span className="block font-medium text-sm">
                          Parcela {installment.installmentNumber}/{installment.totalInstallments}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                          <CalendarDays aria-hidden="true" className="size-3" />
                          Voltar para {formatInstallmentPeriod(installment.originalPeriod)}
                        </span>
                      </Label>
                      <MoneyValue amount={installment.amount} className="shrink-0 font-medium" />
                    </div>
                  );
                })}
              </div>
            </section>

            {detailsQuery.data.discount > 0 ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                O desconto da antecipação será reduzido proporcionalmente às parcelas restauradas.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            data-mobile-cancel
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Manter antecipação
          </Button>
          <Button
            disabled={
              mutation.isPending ||
              detailsQuery.isLoading ||
              detailsQuery.isError ||
              installmentIds.length === 0
            }
            onClick={() => void undoAnticipation()}
            type="button"
          >
            {mutation.isPending
              ? "Restaurando…"
              : installmentIds.length === 0
                ? "Selecione as parcelas"
                : `Restaurar ${installmentIds.length} ${installmentIds.length === 1 ? "parcela" : "parcelas"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

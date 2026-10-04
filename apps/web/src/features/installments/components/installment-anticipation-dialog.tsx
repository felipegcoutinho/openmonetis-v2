import {
  CreateInstallmentAnticipationInputSchema,
  type InstallmentGroupOutput,
  type InstallmentOutput,
} from "@openmonetis/validators/installments";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { CalendarArrowDown, CalendarDays, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  useAnticipateInstallmentsMutation,
  useUndoInstallmentAnticipationMutation,
} from "../installments.mutations";
import { formatInstallmentDate, formatInstallmentPeriod } from "../installments.presentation";
import { installmentQuoteQueryOptions } from "../installments.queries";

export function InstallmentAnticipationDialog({
  eligibleInstallments,
  group,
  onOpenChange,
  open,
  targetPeriod,
}: {
  eligibleInstallments: InstallmentOutput[];
  group: InstallmentGroupOutput | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  targetPeriod: string;
}) {
  const id = useId();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const mutation = useAnticipateInstallmentsMutation();
  const undoMutation = useUndoInstallmentAnticipationMutation();
  const selectedInstallments = eligibleInstallments.filter((installment) =>
    selectedIds.has(installment.id),
  );
  const installmentIds = selectedInstallments.map((installment) => installment.id);
  const quoteQuery = useQuery({
    ...installmentQuoteQueryOptions({ installmentIds }),
    enabled: open && installmentIds.length > 0,
  });
  const quote = quoteQuery.data ?? null;
  const form = useForm({
    defaultValues: { discount: "" },
    onSubmit: async ({ value }) => {
      if (!group || !quote) return;
      const parsed = CreateInstallmentAnticipationInputSchema.safeParse({
        installmentIds,
        targetPeriod,
        discount: Number(value.discount || 0),
      });
      if (!parsed.success || parsed.data.discount > quote.totalAmount) {
        toast.error("Revise o desconto", {
          description: "O desconto não pode superar o total das parcelas.",
        });
        return;
      }
      try {
        const anticipation = await mutation.mutateAsync({
          seriesId: group.seriesId,
          input: parsed.data,
        });
        toast.success("Parcelas antecipadas", {
          description: `A fatura de ${formatInstallmentPeriod(targetPeriod)} foi atualizada.`,
          action: {
            label: "Desfazer",
            onClick: async () => {
              try {
                await undoMutation.mutateAsync({
                  seriesId: group.seriesId,
                  anticipationId: anticipation.id,
                  input: { installmentIds },
                });
                toast.success("Antecipação desfeita");
              } catch {
                toast.error("Não foi possível desfazer a antecipação", {
                  description: "A fatura pode já ter recebido um pagamento.",
                });
              }
            },
          },
        });
        onOpenChange(false);
      } catch (error) {
        const paidInvoice =
          error instanceof ApiClientError && error.code === "installment_target_invoice_paid";
        toast.error(
          paidInvoice ? "Esta fatura já está paga" : "Não foi possível antecipar as parcelas",
          {
            description: paidInvoice
              ? "Escolha um mês com fatura em aberto para receber as parcelas antecipadas."
              : "A seleção ou a fatura pode ter sido alterada. Atualize e tente novamente.",
          },
        );
      }
    },
  });

  return (
    <Dialog onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} open={open}>
      <DialogContent guarded className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-brand/10 text-brand-strong">
            <CalendarArrowDown aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle>Antecipar para esta fatura?</DialogTitle>
          <DialogDescription>
            {group
              ? `Escolha quais parcelas futuras de “${group.name}” serão movidas para ${formatInstallmentPeriod(targetPeriod)}.`
              : "Confira a seleção antes de continuar."}
          </DialogDescription>
        </DialogHeader>

        <form
          data-mobile-page-form
          className="grid min-h-0 gap-5 overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => <MobileFormState {...state} />}
          </form.Subscribe>
          <section className="grid gap-2" aria-labelledby={`${id}-installments-title`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-sm" id={`${id}-installments-title`}>
                  Parcelas futuras
                </h3>
                <p className="text-muted-foreground text-xs">
                  {installmentIds.length} de {eligibleInstallments.length} selecionadas
                </p>
              </div>
              <Button
                onClick={() =>
                  setSelectedIds(
                    installmentIds.length === eligibleInstallments.length
                      ? new Set()
                      : new Set(eligibleInstallments.map((installment) => installment.id)),
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                {installmentIds.length === eligibleInstallments.length
                  ? "Limpar seleção"
                  : "Selecionar todas"}
              </Button>
            </div>

            <div className="grid max-h-[30svh] gap-2 overflow-y-auto pr-1">
              {eligibleInstallments.map((installment) => {
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
                        Parcela {installment.installmentNumber}/{group?.totalInstallments}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                        <CalendarDays aria-hidden="true" className="size-3" />
                        {installment.dueDate
                          ? `Vence em ${formatInstallmentDate(installment.dueDate)}`
                          : formatInstallmentPeriod(installment.period)}
                      </span>
                    </Label>
                    <MoneyValue amount={installment.amount} className="shrink-0 font-medium" />
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <p className="text-muted-foreground text-xs">Total selecionado</p>
              {quoteQuery.isFetching ? (
                <Skeleton className="mt-1 h-7 w-24" />
              ) : (
                <MoneyValue
                  amount={quote?.totalAmount ?? 0}
                  className="mt-1 font-semibold text-lg"
                />
              )}
            </div>
            <form.Subscribe selector={(state) => Number(state.values.discount || 0)}>
              {(discount) => (
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Total na fatura</p>
                  <MoneyValue
                    amount={Math.max(0, (quote?.totalAmount ?? 0) - discount)}
                    className="mt-1 font-semibold text-lg text-brand-strong"
                  />
                </div>
              )}
            </form.Subscribe>
          </div>

          {quoteQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível calcular as parcelas selecionadas. Tente novamente.
            </p>
          ) : null}

          <form.Field name="discount">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-discount`}>Desconto obtido (opcional)</Label>
                <CurrencyInput
                  id={`${id}-discount`}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                />
                <p className="flex items-start gap-1.5 text-muted-foreground text-xs">
                  <Sparkles aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Se o banco concedeu desconto, ele aparecerá como ajuste nesta fatura.
                </p>
              </div>
            )}
          </form.Field>

          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            Essa ação altera a competência das parcelas selecionadas. As parcelas continuam
            identificadas individualmente no histórico.
          </p>

          <DialogFooter>
            <Button
              data-mobile-cancel
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={
                !group ||
                !quote ||
                quoteQuery.isFetching ||
                installmentIds.length === 0 ||
                mutation.isPending
              }
              type="submit"
            >
              {mutation.isPending
                ? "Antecipando…"
                : installmentIds.length === 0
                  ? "Selecione as parcelas"
                  : `Antecipar ${installmentIds.length} ${installmentIds.length === 1 ? "parcela" : "parcelas"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

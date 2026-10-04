import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  CreateTransactionRefundInputSchema,
  type TransactionOutput,
} from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { BadgeDollarSign, CreditCard, Landmark } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRefundTransactionMutation } from "../transactions.mutations";
import { InvoicePeriodPicker } from "./invoice-period-picker";

export function TransactionRefundDialog({
  defaultPeriod,
  onOpenChange,
  open,
  transaction,
}: {
  defaultPeriod: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  transaction: TransactionOutput | null;
}) {
  const id = useId();
  const mutation = useRefundTransactionMutation();
  const today = getCurrentDateInBrazil();
  const form = useForm({
    defaultValues: {
      amount: transaction ? transaction.refundableAmount.toFixed(2) : "",
      receivedAt: today,
      invoicePeriod: transaction?.cardId ? defaultPeriod : "",
      note: "",
    },
    onSubmit: async ({ value }) => {
      if (!transaction?.recordId) return;
      const parsed = CreateTransactionRefundInputSchema.safeParse({
        amount: Number(value.amount),
        receivedAt: value.receivedAt,
        invoicePeriod: transaction.cardId ? value.invoicePeriod : null,
        note: value.note || null,
      });
      if (!parsed.success || parsed.data.amount > transaction.refundableAmount) {
        toast.error("Revise o valor do reembolso", {
          description: "Informe um valor positivo dentro do saldo disponível.",
        });
        return;
      }
      try {
        await mutation.mutateAsync({ id: transaction.recordId, data: parsed.data });
        toast.success("Reembolso registrado", {
          description: transaction.cardId
            ? "O valor foi abatido da fatura selecionada."
            : "O valor foi lançado na conta da compra.",
        });
        onOpenChange(false);
      } catch {
        toast.error("Não foi possível registrar o reembolso", {
          description: "A despesa ou a fatura pode ter sido alterada. Tente novamente.",
        });
      }
    },
  });

  return (
    <Dialog onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} open={open}>
      <DialogContent guarded className="sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 grid size-10 place-items-center rounded-full bg-success/10 text-success">
            <BadgeDollarSign aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle>Registrar reembolso</DialogTitle>
          <DialogDescription>
            {transaction
              ? `Vincule a devolução à despesa “${transaction.name}” para manter seus indicadores corretos.`
              : "Informe os dados da devolução."}
          </DialogDescription>
        </DialogHeader>

        <form
          data-mobile-page-form
          className="grid gap-4"
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
          <Card className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-4">
            <div>
              <p className="text-muted-foreground text-xs">Valor da despesa</p>
              <MoneyValue amount={transaction?.displayAmount ?? 0} className="mt-1 font-semibold" />
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Disponível para reembolso</p>
              <MoneyValue
                amount={transaction?.refundableAmount ?? 0}
                className="mt-1 font-semibold text-success"
              />
            </div>
          </Card>

          <form.Field name="amount">
            {(field) => (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${id}-amount`}>Valor recebido</Label>
                  {transaction && field.state.value !== transaction.refundableAmount.toFixed(2) ? (
                    <Button
                      className="h-auto px-0 py-0 text-xs"
                      onClick={() => field.handleChange(transaction.refundableAmount.toFixed(2))}
                      type="button"
                      variant="link"
                    >
                      Usar valor total
                    </Button>
                  ) : null}
                </div>
                <CurrencyInput
                  id={`${id}-amount`}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="receivedAt">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-received-at`}>Data do reembolso</Label>
                <DatePicker
                  id={`${id}-received-at`}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          {transaction?.cardId ? (
            <form.Field name="invoicePeriod">
              {(field) => (
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 font-medium text-sm">
                    <CreditCard aria-hidden="true" className="size-4 text-brand-strong" />
                    Fatura que receberá o crédito
                  </p>
                  <InvoicePeriodPicker
                    cardId={transaction.cardId ?? undefined}
                    onChange={field.handleChange}
                    purchaseDate={form.state.values.receivedAt}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border p-3 text-muted-foreground text-sm">
              <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0" />O valor entrará em{" "}
              {transaction?.accountName ?? "a conta vinculada à despesa"}.
            </p>
          )}

          <form.Field name="note">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-note`}>Observação (opcional)</Label>
                <Textarea
                  id={`${id}-note`}
                  maxLength={1000}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: estorno parcial do pedido"
                  rows={3}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

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
            <Button disabled={!transaction || mutation.isPending} type="submit">
              {mutation.isPending ? "Registrando…" : "Confirmar reembolso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

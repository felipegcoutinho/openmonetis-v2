import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import { SettleTransactionsInputSchema } from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { toast } from "sonner";
import { MobileDatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityOption } from "./transaction-entity-option";
export type SettlementTarget = {
  ids?: string[];
  recurringRuleId?: string;
  purchaseDate?: string;
  type: "income" | "expense";
  name: string;
  plannedAmount: number;
  accountId: string | null;
  divided: boolean;
};
export type SettlementValues = { settledDate: string; settledAmount?: number; accountId: string };
export function TransactionSettlementDialog({
  target,
  accounts,
  onClose,
  onConfirm,
}: {
  target: SettlementTarget;
  accounts: AccountOutput[];
  onClose: () => void;
  onConfirm: (values: SettlementValues) => Promise<void>;
}) {
  const id = useId();
  const income = target.type === "income";
  const multiple = (target.ids?.length ?? 0) > 1;
  const form = useForm({
    defaultValues: {
      settledDate: getCurrentDateInBrazil(),
      amount: String(target.plannedAmount),
      accountId:
        accounts.find((account) => account.id === target.accountId && !account.isArchived)?.id ??
        accounts.find((account) => !account.isArchived)?.id ??
        "",
    },
    onSubmit: async ({ value }) => {
      const parsed = SettleTransactionsInputSchema.safeParse({
        ids: target.ids ?? [target.recurringRuleId],
        isSettled: true,
        settledDate: value.settledDate,
        settledAmount: multiple ? undefined : Number(value.amount),
        accountId: value.accountId,
      });
      if (!parsed.success || value.settledDate > getCurrentDateInBrazil()) {
        toast.error("Confira o valor, a conta e a data da baixa.");
        return;
      }
      try {
        await onConfirm({
          settledDate: value.settledDate,
          settledAmount: multiple ? undefined : Number(value.amount),
          accountId: value.accountId,
        });
        onClose();
      } catch {
        toast.error(
          "Não foi possível registrar a baixa. Confira se o lançamento continua pendente.",
        );
      }
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !form.state.isSubmitting) onClose();
      }}
    >
      <DialogContent guarded mobileLayout="sheet" className="gap-4">
        <DialogHeader>
          <DialogTitle>{income ? "Registrar recebimento" : "Registrar pagamento"}</DialogTitle>
          <DialogDescription>
            {target.name}. Informe os dados da baixa já realizada.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">
          {multiple
            ? `${target.ids?.length} lançamentos serão confirmados pelos respectivos valores previstos.`
            : `Valor previsto: ${target.plannedAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
        </p>
        <form
          className="grid gap-4"
          data-mobile-page-form
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
          {!multiple ? (
            <form.Field name="amount">
              {(field) => (
                <div className="grid gap-2">
                  <Label className="font-mono" htmlFor={`${id}-amount`}>
                    {income ? "Valor recebido" : "Valor pago"}
                  </Label>
                  <CurrencyInput
                    id={`${id}-amount`}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  />
                </div>
              )}
            </form.Field>
          ) : null}
          <form.Field name="settledDate">
            {(field) => (
              <div className="grid gap-2">
                <Label className="font-mono" htmlFor={`${id}-date`}>
                  {income ? "Data do recebimento" : "Data do pagamento"}
                </Label>
                <MobileDatePicker
                  id={`${id}-date`}
                  max={getCurrentDateInBrazil()}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="accountId">
            {(field) => (
              <div className="grid gap-2">
                <Label className="font-mono" htmlFor={`${id}-account`}>
                  {multiple ? "Conta para todos os lançamentos" : "Conta da baixa"}
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => value && field.handleChange(value)}
                >
                  <SelectTrigger id={`${id}-account`} className="w-full">
                    <SelectValue placeholder="Selecione a conta">
                      <EntityOption
                        entity={accounts.find((account) => account.id === field.state.value)}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((account) => !account.isArchived)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <EntityOption entity={account} />
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          {target.divided ? (
            <p className="text-muted-foreground text-xs">
              O valor efetivo será dividido proporcionalmente entre as pessoas. Confira o valor
              antes de confirmar.
            </p>
          ) : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Registrando…" : "Confirmar baixa"}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}

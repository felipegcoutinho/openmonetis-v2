import { maximumInstallmentCount, minimumInstallmentCount } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  type InstallmentPurchaseSimulationOutput,
  SimulateInstallmentPurchaseInputSchema,
} from "@openmonetis/validators/installments";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useId, useState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { InvoicePeriodPicker } from "@/features/transactions/components/invoice-period-picker";
import { ApiClientError } from "@/lib/api-client";
import { useInstallmentPurchaseSimulationMutation } from "../installments.mutations";
import { CardOptionAvatar } from "./card-option-avatar";

const installmentCountOptions = Array.from(
  { length: maximumInstallmentCount - minimumInstallmentCount + 1 },
  (_, index) => String(index + minimumInstallmentCount),
);
const amountSchema = SimulateInstallmentPurchaseInputSchema.shape.amount;
const installmentCountSchema = SimulateInstallmentPurchaseInputSchema.shape.installmentCount;
const cardIdSchema = SimulateInstallmentPurchaseInputSchema.shape.cardId;
const nameMaxLength = 120;

type InstallmentPurchaseSimulationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The simulation being edited, so the form starts from its values. */
  simulation: InstallmentPurchaseSimulationOutput | null;
  onSimulated: (simulation: InstallmentPurchaseSimulationOutput) => void;
};

export function InstallmentPurchaseSimulationDialog({
  open,
  onOpenChange,
  simulation,
  onSimulated,
}: InstallmentPurchaseSimulationDialogProps) {
  const id = useId();
  const today = getCurrentDateInBrazil();
  const [error, setError] = useState<string | null>(null);
  const cardsQuery = useQuery({ ...cardsQueryOptions(), enabled: open });
  const activeCards = (cardsQuery.data ?? []).filter((card) => card.status === "active");
  const mutation = useInstallmentPurchaseSimulationMutation();
  const form = useForm({
    defaultValues: {
      name: simulation?.name ?? "",
      amount: simulation ? simulation.amount.toFixed(2) : "",
      installmentCount: String(simulation?.installmentCount ?? 10),
      cardId: simulation?.cardId ?? "",
      // Empty means "follow the card's closing rule", which the picker shows as a forecast.
      invoicePeriod: simulation?.invoicePeriodChosen ? simulation.firstPeriod : "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = SimulateInstallmentPurchaseInputSchema.safeParse({
        amount: Number(value.amount),
        installmentCount: Number(value.installmentCount),
        cardId: value.cardId,
        name: value.name.trim() || undefined,
        invoicePeriod: value.invoicePeriod || undefined,
      });
      if (!parsed.success) return;
      try {
        onSimulated(await mutation.mutateAsync(parsed.data));
        onOpenChange(false);
      } catch (cause) {
        setError(
          cause instanceof ApiClientError && cause.code === "installment_simulation_card_not_found"
            ? "Esse cartão não está mais disponível. Escolha outro."
            : cause instanceof ApiClientError &&
                cause.code === "installment_simulation_invoice_before_current_month"
              ? "Escolha a fatura deste mês ou de um mês seguinte."
              : "Não foi possível simular a compra. Tente novamente.",
        );
      }
    },
  });

  return (
    <Dialog onOpenChange={(next) => !mutation.isPending && onOpenChange(next)} open={open}>
      <DialogContent guarded className="sm:max-w-md">
        <DialogHeader>
          <DialogMedia>
            <ShoppingBag />
          </DialogMedia>
          <DialogTitle>Simular compra parcelada</DialogTitle>
          <DialogDescription className="text-pretty">
            Veja como uma compra no cartão ocuparia os próximos meses. Nada é salvo e nenhum outro
            relatório muda.
          </DialogDescription>
        </DialogHeader>

        <form
          data-mobile-page-form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
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

          <form.Field name="name">
            {(field) => (
              <div className="grid gap-2">
                <Label className="font-mono" htmlFor={`${id}-name`}>
                  Nome (opcional)
                </Label>
                <Input
                  autoFocus
                  id={`${id}-name`}
                  maxLength={nameMaxLength}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: Geladeira nova"
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="amount"
            validators={{
              onSubmit: ({ value }) =>
                amountSchema.safeParse(Number(value)).success
                  ? undefined
                  : "Informe o valor total da compra.",
            }}
          >
            {(field) => (
              <div className="grid gap-2">
                <Label className="font-mono" htmlFor={`${id}-amount`}>
                  Valor total
                </Label>
                <CurrencyInput
                  aria-invalid={field.state.meta.errors.length > 0}
                  id={`${id}-amount`}
                  onValueChange={field.handleChange}
                  placeholder="R$ 0,00"
                  value={field.state.value}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="installmentCount"
            validators={{
              onSubmit: ({ value }) =>
                installmentCountSchema.safeParse(Number(value)).success
                  ? undefined
                  : "Escolha a quantidade de parcelas.",
            }}
          >
            {(field) => (
              <div className="grid gap-2">
                <Label className="font-mono" htmlFor={`${id}-count`}>
                  Parcelas
                </Label>
                <Select
                  onValueChange={(value) => {
                    if (value) field.handleChange(value);
                  }}
                  value={field.state.value}
                >
                  <SelectTrigger className="w-full" id={`${id}-count`}>
                    <SelectValue>{`${field.state.value}x`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {installmentCountOptions.map((count) => (
                      <SelectItem key={count} value={count}>
                        {count}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field
            name="cardId"
            validators={{
              onSubmit: ({ value }) =>
                cardIdSchema.safeParse(value).success ? undefined : "Escolha um cartão.",
            }}
          >
            {(field) => {
              const selected = activeCards.find((card) => card.id === field.state.value);
              return (
                <div className="grid gap-2">
                  <Label className="font-mono" htmlFor={`${id}-card`}>
                    Cartão
                  </Label>
                  {cardsQuery.isLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : activeCards.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-muted-foreground text-sm">
                      Cadastre um cartão ativo para simular uma compra parcelada.
                    </p>
                  ) : (
                    <Select
                      onValueChange={(value) => {
                        if (!value) return;
                        field.handleChange(value);
                        // A new card has its own closing day, so the forecast starts over.
                        form.setFieldValue("invoicePeriod", "");
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={field.state.meta.errors.length > 0}
                        className="w-full"
                        id={`${id}-card`}
                      >
                        <SelectValue placeholder="Selecione">
                          {selected ? (
                            <span className="flex min-w-0 items-center gap-2">
                              <CardOptionAvatar logo={selected.logo} />
                              <span className="truncate">{selected.name}</span>
                            </span>
                          ) : (
                            "Selecione"
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {activeCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            <CardOptionAvatar logo={card.logo} />
                            {card.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FieldError errors={field.state.meta.errors} />
                  {field.state.value ? (
                    <form.Field name="invoicePeriod">
                      {(invoiceField) => (
                        <InvoicePeriodPicker
                          cardId={field.state.value}
                          onChange={invoiceField.handleChange}
                          purchaseDate={today}
                          value={invoiceField.state.value}
                        />
                      )}
                    </form.Field>
                  ) : null}
                </div>
              );
            }}
          </form.Field>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

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
            <Button disabled={mutation.isPending || activeCards.length === 0} type="submit">
              {mutation.isPending ? "Simulando…" : simulation ? "Atualizar simulação" : "Simular"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

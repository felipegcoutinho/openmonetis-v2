import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import {
  type CreatePersonSettlementInput,
  CreatePersonSettlementInputSchema,
} from "@openmonetis/validators/person-settlements";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseCurrencyInput } from "@/features/accounts/accounts.presentation";

type Props = {
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePersonSettlementInput) => Promise<void>;
  open: boolean;
  personId: string;
  personName: string;
};

export function PersonSettlementDialog({
  onOpenChange,
  onSubmit,
  open,
  personId,
  personName,
}: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded mobileLayout="sheet" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar repasse</DialogTitle>
          <DialogDescription>
            Registre o valor pago por {personName}. Isso atualiza somente o acerto da pessoa, sem
            movimentar suas contas.
          </DialogDescription>
        </DialogHeader>
        <PersonSettlementForm
          key={`${personId}:${open ? "open" : "closed"}`}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          personId={personId}
        />
      </DialogContent>
    </Dialog>
  );
}

function PersonSettlementForm({
  onCancel,
  onSubmit,
  personId,
}: Omit<Props, "onOpenChange" | "open" | "personName"> & { onCancel: () => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      amount: "",
      receivedAt: getCurrentDateInBrazil(),
      note: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = CreatePersonSettlementInputSchema.safeParse({
        personId,
        amount: parseCurrencyInput(value.amount),
        receivedAt: value.receivedAt,
        note: value.note.trim() || null,
      });
      if (!parsed.success) {
        setError("Informe um valor e uma data válidos.");
        return;
      }
      try {
        await onSubmit(parsed.data);
      } catch {
        setError("Não foi possível registrar o repasse.");
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <form.Field name="amount">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-amount`}>Valor recebido</Label>
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
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-date`}>Data do repasse</Label>
            <DatePicker
              id={`${id}-date`}
              max={getCurrentDateInBrazil()}
              onChange={field.handleChange}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="note">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-note`}>Observação (opcional)</Label>
            <Textarea
              id={`${id}-note`}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Ex.: pagamento parcial"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button data-mobile-cancel onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <form.Subscribe
          selector={(state) => ({ values: state.values, isSubmitting: state.isSubmitting })}
        >
          {({ values, isSubmitting }) => (
            <Button disabled={isSubmitting || !values.amount} type="submit">
              {isSubmitting ? "Registrando…" : "Registrar repasse"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

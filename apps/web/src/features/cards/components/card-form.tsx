import { FormActions } from "@/components/forms/form-actions";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { LogoPicker } from "@/components/logo-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logoCatalog } from "@/lib/logo-catalog";
import { getCardLogoDisplayName } from "../cards.presentation";
import { useCardForm } from "../useCardForm";
import { CardAccountField } from "./card-account-field";
import { CardClosingFields } from "./card-closing-fields";
import type { CardFormProps } from "./card-form.types";
import { CardIdentityFields } from "./card-identity-fields";

export function CardForm({ accounts, card, onCancel, onSubmit }: CardFormProps) {
  const { submissionError, isEditing, form, fieldId } = useCardForm({
    accounts,
    card,
    onCancel,
    onSubmit,
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
      <form.Field name="logo">
        {(field) => (
          <LogoPicker
            allowEmpty
            dialogTitle="Selecionar instituição"
            label="Instituição"
            onChange={(logo) => {
              field.handleChange(logo);
              form.setFieldValue("name", getCardLogoDisplayName(logo));
            }}
            options={logoCatalog}
            searchPlaceholder="Buscar emissor do cartão"
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <CardIdentityFields form={form} fieldId={fieldId} />
        <CardClosingFields form={form} fieldId={fieldId} />{" "}
        <CardAccountField accounts={accounts} form={form} fieldId={fieldId} />
        <form.Field name="note">
          {(field) => (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fieldId(field.name)}>Anotação</Label>
              <Textarea
                id={fieldId(field.name)}
                maxLength={1000}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Observações sobre este cartão"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>

      {submissionError ? (
        <p className="text-destructive text-sm" role="alert">
          {submissionError}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <FormActions
            busy={isSubmitting}
            onCancel={onCancel}
            submitAriaDisabled={!canSubmit || accounts.length === 0}
            submitDisabled={accounts.length === 0}
            submitLabel={isEditing ? "Atualizar" : "Salvar cartão"}
          />
        )}
      </form.Subscribe>
    </form>
  );
}

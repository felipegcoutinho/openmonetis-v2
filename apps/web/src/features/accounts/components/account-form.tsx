import type {
  AccountOutput,
  CreateAccountInput,
  ReplaceAccountInput,
} from "@openmonetis/validators/accounts";
import {
  CreateAccountInputSchema,
  ReplaceAccountInputSchema,
} from "@openmonetis/validators/accounts";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { LogoPicker } from "@/components/logo-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { logoCatalog } from "@/lib/logo-catalog";
import { accountTypeOptions, getLogoDisplayName } from "../accounts.presentation";

type AccountFormProps = {
  account?: AccountOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateAccountInput | ReplaceAccountInput) => Promise<void>;
};

type FormValues = {
  name: string;
  type: CreateAccountInput["type"];
  logo: string | null;
  note: string;
  excludeFromBalance: boolean;
  isArchived: boolean;
};

function getInitialValues(account?: AccountOutput | null): FormValues {
  return {
    name: account?.name ?? "",
    type: account?.type ?? "checking",
    logo: account?.logo ?? null,
    note: account?.note ?? "",
    excludeFromBalance: account?.excludeFromBalance ?? false,
    isArchived: account?.isArchived ?? false,
  };
}

function validationMessage(result: { success: boolean }, message: string) {
  return result.success ? undefined : message;
}

function FieldError({ errors }: { errors: unknown[] }) {
  const message = errors.find((error): error is string => typeof error === "string");

  if (!message) return null;

  return (
    <p aria-live="polite" className="text-destructive text-xs" role={message ? "alert" : undefined}>
      {message}
    </p>
  );
}

export function AccountForm({ account, onCancel, onSubmit }: AccountFormProps) {
  const idPrefix = useId();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isEditing = Boolean(account);
  const form = useForm({
    defaultValues: getInitialValues(account),
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setSubmissionError(null);

      const baseInput = {
        name: value.name.trim(),
        type: value.type,
        logo: value.logo || null,
        note: value.note.trim() || null,
        excludeFromBalance: value.excludeFromBalance,
      };
      const result = isEditing
        ? ReplaceAccountInputSchema.safeParse({ ...baseInput, isArchived: value.isArchived })
        : CreateAccountInputSchema.safeParse(baseInput);

      if (!result.success) {
        showInvalidFormToast();
        return;
      }

      try {
        await onSubmit(result.data);
        toast.success(isEditing ? "Conta atualizada" : "Conta criada", {
          description: `${value.name.trim()} foi salva com sucesso.`,
        });
      } catch {
        const message = "Não foi possível salvar.";
        setSubmissionError(message);
        toast.error(message);
      }
    },
  });

  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
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
              const name = form.getFieldValue("name");
              const shouldUpdateName =
                !name.trim() || name === getLogoDisplayName(field.state.value);
              field.handleChange(logo);
              if (shouldUpdateName) form.setFieldValue("name", getLogoDisplayName(logo));
            }}
            options={logoCatalog}
            searchPlaceholder="Buscar banco, carteira ou corretora"
            value={field.state.value}
          />
        )}
      </form.Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{
            onBlur: ({ value }) =>
              validationMessage(
                CreateAccountInputSchema.shape.name.safeParse(value),
                "Informe o nome.",
              ),
          }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Nome</Label>
              <Input
                aria-invalid={!field.state.meta.isValid}
                id={fieldId(field.name)}
                maxLength={120}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Nubank"
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="type">
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={fieldId(field.name)}>Tipo de conta</Label>
              <Select
                onValueChange={(type) => {
                  if (type) field.handleChange(type);
                }}
                value={field.state.value}
              >
                <SelectTrigger className="w-full" id={fieldId(field.name)}>
                  <SelectValue placeholder="Selecione o tipo">
                    {accountTypeOptions.find((option) => option.value === field.state.value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accountTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        {isEditing ? (
          <form.Field name="isArchived">
            {(field) => (
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor={fieldId(field.name)}>Status</Label>
                <Select
                  onValueChange={(status) => field.handleChange(status === "inactive")}
                  value={field.state.value ? "inactive" : "active"}
                >
                  <SelectTrigger className="w-full" id={fieldId(field.name)}>
                    <SelectValue>
                      <AccountStatusOption archived={field.state.value} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <AccountStatusOption archived={false} />
                    </SelectItem>
                    <SelectItem value="inactive">
                      <AccountStatusOption archived />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        ) : null}

        <form.Field
          name="note"
          validators={{
            onBlur: ({ value }) =>
              validationMessage(
                CreateAccountInputSchema.shape.note.safeParse(value || null),
                "Anotação inválida.",
              ),
          }}
        >
          {(field) => (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={fieldId(field.name)}>Anotação</Label>
              <Textarea
                aria-invalid={!field.state.meta.isValid}
                id={fieldId(field.name)}
                maxLength={1000}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Informações adicionais sobre a conta"
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>
      </div>

      <div className="grid gap-3">
        <form.Field name="excludeFromBalance">
          {(field) => (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={field.state.value}
                id={fieldId(field.name)}
                name={field.name}
                onBlur={field.handleBlur}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <Label
                className="cursor-pointer font-normal leading-tight"
                htmlFor={fieldId(field.name)}
              >
                Desconsiderar do saldo total (útil para contas de investimento ou reserva)
              </Label>
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
          <div data-mobile-form-actions className="grid w-full grid-cols-2 gap-2 [&>*]:w-full">
            <Button
              data-mobile-cancel
              disabled={isSubmitting}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button aria-disabled={!canSubmit} disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function AccountStatusOption({ archived }: { archived: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${archived ? "bg-muted-foreground" : "bg-emerald-500"}`}
      />
      {archived ? "Inativa" : "Ativa"}
    </span>
  );
}

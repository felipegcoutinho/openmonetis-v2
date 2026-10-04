import type {
  CreatePersonInput,
  PersonOutput,
  ReplacePersonInput,
} from "@openmonetis/validators/people";
import { CreatePersonInputSchema, ReplacePersonInputSchema } from "@openmonetis/validators/people";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { avatarOptions } from "../avatar-catalog";
import { AvatarPicker } from "./avatar-picker";

export function PersonForm({
  person,
  onCancel,
  onSubmit,
}: {
  person?: PersonOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreatePersonInput | ReplacePersonInput) => Promise<void>;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const editing = Boolean(person);
  const isAdmin = person?.role === "admin";
  const form = useForm({
    defaultValues: {
      name: person?.name ?? "",
      email: person?.email ?? "",
      status: isAdmin ? ("active" as const) : (person?.status ?? ("active" as const)),
      avatarUrl: person?.avatarUrl ?? avatarOptions[0],
      note: person?.note ?? "",
    },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      setError(null);
      const input = {
        ...value,
        email: value.email.trim() || null,
        avatarUrl: value.avatarUrl || null,
        note: value.note.trim() || null,
      };
      const result = (editing ? ReplacePersonInputSchema : CreatePersonInputSchema).safeParse(
        input,
      );
      if (!result.success) {
        showInvalidFormToast();
        return;
      }
      try {
        await onSubmit(result.data);
        toast.success(editing ? "Pessoa atualizada" : "Pessoa criada");
      } catch {
        setError("Não foi possível salvar.");
        toast.error("Não foi possível salvar.");
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
      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field
          name="name"
          validators={{
            onBlur: ({ value }) =>
              CreatePersonInputSchema.shape.name.safeParse(value).success
                ? undefined
                : "Informe o nome.",
          }}
        >
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-name`}>Nome</Label>
              <Input
                aria-invalid={field.state.meta.errors.length > 0}
                id={`${id}-name`}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: Ana Silva"
                value={field.state.value}
              />
              <p aria-live="polite" className="text-destructive text-xs" role="alert">
                {field.state.meta.errors[0] ?? ""}
              </p>
            </div>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-email`}>E-mail</Label>
              <Input
                id={`${id}-email`}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Ex.: ana@email.com"
                type="email"
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
      </div>
      <form.Field name="status">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-status`}>Status</Label>
            <Select
              disabled={isAdmin}
              onValueChange={(value) => {
                if (value) field.handleChange(value);
              }}
              value={field.state.value}
            >
              <SelectTrigger className="w-full" id={`${id}-status`}>
                <SelectValue>
                  <StatusOption status={field.state.value} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <StatusOption status="active" />
                </SelectItem>
                <SelectItem value="inactive">
                  <StatusOption status="inactive" />
                </SelectItem>
              </SelectContent>
            </Select>
            {isAdmin ? (
              <p className="text-muted-foreground text-xs">
                A pessoa administradora permanece sempre ativa.
              </p>
            ) : null}
          </div>
        )}
      </form.Field>
      <form.Field name="avatarUrl">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-avatar`}>Avatar</Label>
            <AvatarPicker
              id={`${id}-avatar`}
              onChange={field.handleChange}
              onProcessingChange={setProcessingAvatar}
              providerAvatarUrl={person?.role === "admin" ? person.providerAvatarUrl : null}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="note">
        {(field) => (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-note`}>Anotações</Label>
            <Textarea
              id={`${id}-note`}
              maxLength={1000}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Observações sobre esta pessoa"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <div data-mobile-form-actions className="grid w-full grid-cols-2 gap-2 *:w-full">
            <Button
              data-mobile-cancel
              disabled={submitting || processingAvatar}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={submitting || processingAvatar} type="submit">
              {processingAvatar
                ? "Processando..."
                : submitting
                  ? "Salvando..."
                  : editing
                    ? "Atualizar"
                    : "Salvar"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
function StatusOption({ status }: { status: "active" | "inactive" }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`size-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`}
      />
      <span>{status === "active" ? "Ativa" : "Inativa"}</span>
    </span>
  );
}

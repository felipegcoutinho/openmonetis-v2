import { ChangePasswordInputSchema, PasswordSchema } from "@openmonetis/validators/auth";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobilePageFormGuard } from "@/components/forms/mobile-page-form-guard";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangeSettingsPasswordMutation } from "../settings.mutations";
import { passwordMutationErrorMessage } from "../settings.presentation";
import { settingsSecurityQueryOptions } from "../settings.queries";

export function PasswordSettings() {
  const securityQuery = useQuery(settingsSecurityQueryOptions());

  return (
    <SettingsSection
      contentClassName="grid gap-5"
      description="Gerencie a senha usada para entrar com seu e-mail."
      icon={KeyRound}
      title="Senha de acesso"
    >
      {securityQuery.isPending ? <PasswordSettingsSkeleton /> : null}

      {securityQuery.isError ? (
        <SettingsQueryError
          message="Não foi possível carregar as opções de senha."
          isRetrying={securityQuery.isFetching}
          onRetry={() => void securityQuery.refetch()}
        />
      ) : null}

      {securityQuery.data?.passwordChangeAvailable === false ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="font-medium text-sm">Esta conta não possui senha</p>
          <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
            Seu acesso foi criado com o Google. Para alterar a senha da conta Google, use as
            configurações do próprio Google.
          </p>
        </div>
      ) : null}

      {securityQuery.data?.passwordChangeAvailable ? (
        <Accordion>
          <AccordionItem value="password">
            <AccordionTrigger className="flex-wrap items-center gap-3 py-1 hover:no-underline sm:flex-nowrap">
              <span className="grid min-w-0 basis-full gap-1 sm:basis-auto">
                <span>Senha cadastrada</span>
                <span className="font-normal text-muted-foreground">
                  Você pode atualizar sua senha a qualquer momento.
                </span>
              </span>
              <span className="shrink-0 text-brand-strong sm:ml-auto">Alterar senha</span>
            </AccordionTrigger>
            <AccordionContent className="pt-5 pb-0">
              <ChangePasswordForm />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </SettingsSection>
  );
}

function ChangePasswordForm() {
  const id = useId();
  const mutation = useChangeSettingsPasswordMutation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      passwordConfirmation: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const input = ChangePasswordInputSchema.safeParse(value);
      if (!input.success) {
        setError("Revise as senhas informadas.");
        return;
      }

      try {
        await mutation.mutateAsync(input.data);
        form.reset();
        toast.success("Senha alterada", {
          description: "As outras sessões da sua conta foram encerradas.",
        });
      } catch (cause) {
        const message = passwordMutationErrorMessage(cause);
        setError(message);
        toast.error(message);
      } finally {
        mutation.reset();
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid max-w-xl gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobilePageFormGuard {...state} />}
      </form.Subscribe>
      <p className="rounded-lg bg-muted/40 p-3 text-muted-foreground text-sm leading-relaxed">
        Ao salvar, as outras sessões da sua conta serão encerradas. Este acesso continuará ativo.
      </p>
      <form.Field
        name="currentPassword"
        validators={{
          onBlur: ({ value }) => (value.length > 0 ? undefined : "Informe sua senha atual."),
        }}
      >
        {(field) => (
          <PasswordField
            autoComplete="current-password"
            disabled={mutation.isPending}
            error={field.state.meta.errors[0]}
            id={`${id}-current-password`}
            label="Senha atual"
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      <form.Field
        name="newPassword"
        validators={{
          onBlur: ({ value }) => {
            if (!PasswordSchema.safeParse(value).success) {
              return "Use uma senha entre 8 e 128 caracteres.";
            }
            return value === form.getFieldValue("currentPassword")
              ? "A nova senha deve ser diferente da atual."
              : undefined;
          },
        }}
      >
        {(field) => (
          <PasswordField
            autoComplete="new-password"
            disabled={mutation.isPending}
            error={field.state.meta.errors[0]}
            hint="Use entre 8 e 128 caracteres."
            id={`${id}-new-password`}
            label="Nova senha"
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      <form.Field
        name="passwordConfirmation"
        validators={{
          onBlur: ({ value }) =>
            value === form.getFieldValue("newPassword") ? undefined : "As senhas não coincidem.",
        }}
      >
        {(field) => (
          <PasswordField
            autoComplete="new-password"
            disabled={mutation.isPending}
            error={field.state.meta.errors[0]}
            id={`${id}-password-confirmation`}
            label="Confirmar nova senha"
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button className="w-full sm:w-fit" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <KeyRound aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Alterando..." : "Alterar senha"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function PasswordField({
  error,
  hint,
  id,
  label,
  onChange,
  ...props
}: {
  error?: unknown;
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof PasswordInput>, "id" | "onChange">) {
  const errorMessage = typeof error === "string" ? error : null;
  const descriptionId = errorMessage ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-2">
      <Label className="font-sans text-sm tracking-normal" htmlFor={id}>
        {label}
      </Label>
      <PasswordInput
        {...props}
        aria-describedby={descriptionId}
        aria-invalid={Boolean(errorMessage)}
        id={id}
        onChange={(event) => onChange(event.target.value)}
      />
      {errorMessage ? (
        <p className="text-destructive text-xs" id={`${id}-error`}>
          {errorMessage}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PasswordSettingsSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4" role="status">
      <span className="sr-only">Carregando opções de senha</span>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}
